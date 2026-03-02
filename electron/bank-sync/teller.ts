import https from 'https'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

interface TellerAccount {
  id: string
  name: string
  type: string    // depository, credit
  subtype: string // checking, savings, credit_card
  status: string
  currency: string
  institution: {
    id: string
    name: string
  }
  last_four: string
}

interface TellerBalance {
  account_id: string
  ledger: string  // decimal string
  available: string
}

interface TellerTransaction {
  id: string
  account_id: string
  date: string  // YYYY-MM-DD
  description: string
  amount: string // decimal string, signed
  status: 'posted' | 'pending'
  type: string
  category: string[]
  merchant_name?: string
}

/** Load mTLS certificate and private key from the app's teller directory */
function loadCertificates(): { cert: Buffer; key: Buffer } {
  const tellerDir = path.join(app.getPath('userData'), 'teller')
  const certPath = path.join(tellerDir, 'certificate.pem')
  const keyPath = path.join(tellerDir, 'private_key.pem')

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error(
      `Teller certificates not found. Place certificate.pem and private_key.pem in:\n${tellerDir}`
    )
  }

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  }
}

/**
 * Fetch all accounts from Teller.
 */
export async function fetchAccounts(accessToken: string): Promise<{
  accounts: {
    externalId: string
    name: string
    institution: string
    accountType: 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other'
    balance: number
    availableBalance?: number
    currency: string
    transactions: {
      externalId: string
      amount: number
      date: string
      description: string
      merchant?: string
      pending: boolean
    }[]
  }[]
}> {
  // Fetch accounts
  const rawAccounts: TellerAccount[] = JSON.parse(await tellerGet('/accounts', accessToken))

  const accounts = []
  for (const acct of rawAccounts) {
    // Fetch balances
    let balance = 0
    let availableBalance: number | undefined
    try {
      const rawBalances: TellerBalance = JSON.parse(await tellerGet(`/accounts/${acct.id}/balances`, accessToken))
      balance = dollarsToCents(rawBalances.ledger)
      availableBalance = rawBalances.available ? dollarsToCents(rawBalances.available) : undefined
    } catch {
      // Balance fetch might fail for some account types
    }

    // For credit accounts, balance represents what you owe (make it negative)
    if (acct.type === 'credit') {
      balance = -Math.abs(balance)
    }

    // Fetch transactions
    let transactions: {
      externalId: string
      amount: number
      date: string
      description: string
      merchant?: string
      pending: boolean
    }[] = []
    try {
      const rawTxs: TellerTransaction[] = JSON.parse(await tellerGet(`/accounts/${acct.id}/transactions`, accessToken))
      transactions = rawTxs.map(tx => ({
        externalId: tx.id,
        amount: dollarsToCents(tx.amount),
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant_name || undefined,
        pending: tx.status === 'pending',
      }))
    } catch {
      // Transaction fetch might fail for some account types
    }

    accounts.push({
      externalId: acct.id,
      name: acct.name,
      institution: acct.institution?.name || 'Unknown',
      accountType: mapTellerAccountType(acct.type, acct.subtype),
      balance,
      availableBalance,
      currency: acct.currency || 'USD',
      transactions,
    })
  }

  return { accounts }
}

function mapTellerAccountType(type: string, subtype: string): 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other' {
  if (type === 'credit') return 'credit_card'
  if (subtype === 'checking') return 'checking'
  if (subtype === 'savings') return 'savings'
  if (type === 'loan' || subtype === 'loan') return 'loan'
  if (subtype === 'mortgage') return 'mortgage'
  return 'other'
}

function dollarsToCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100)
}

/**
 * Make an authenticated GET request to the Teller API.
 * Uses mTLS (client certificate) + HTTP Basic Auth (token as username, empty password).
 */
function tellerGet(apiPath: string, accessToken: string): Promise<string> {
  const { cert, key } = loadCertificates()

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.teller.io',
      path: apiPath,
      method: 'GET',
      // mTLS — client certificate authentication
      cert,
      key,
      // HTTP Basic Auth — token as username, empty password
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accessToken}:`).toString('base64'),
        'Accept': 'application/json',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Teller API ${res.statusCode}: ${data}`))
        } else {
          resolve(data)
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Teller API timeout')) })
    req.end()
  })
}
