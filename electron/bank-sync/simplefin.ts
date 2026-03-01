import https from 'https'
import http from 'http'

interface SimpleFINAccount {
  id: string
  name: string
  currency: string
  balance: string // decimal string
  'available-balance'?: string
  'balance-date': number // Unix timestamp
  transactions: SimpleFINTransaction[]
  org: {
    name: string
    domain?: string
    'sfin-url'?: string
  }
}

interface SimpleFINTransaction {
  id: string
  posted: number  // Unix timestamp
  amount: string  // decimal string, signed
  description: string
  payee?: string
  memo?: string
  pending?: boolean
}

interface SimpleFINResponse {
  errors: string[]
  accounts: SimpleFINAccount[]
}

/**
 * Exchange a SimpleFIN setup token for a persistent access URL.
 * Setup tokens are base64-encoded claim URLs.
 */
export async function exchangeSetupToken(setupToken: string): Promise<string> {
  // Decode base64 setup token to get the claim URL
  const claimUrl = Buffer.from(setupToken.trim(), 'base64').toString('utf-8')

  // POST to the claim URL to get the access URL
  const accessUrl = await httpPost(claimUrl)

  if (!accessUrl || !accessUrl.includes('://')) {
    throw new Error('Invalid access URL received from SimpleFIN')
  }

  return accessUrl.trim()
}

/**
 * Fetch all accounts (with balances and transactions) from SimpleFIN.
 */
export async function fetchAccounts(accessUrl: string): Promise<{
  accounts: {
    externalId: string
    name: string
    institution: string
    accountType: 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other'
    balance: number  // cents
    availableBalance?: number
    currency: string
    transactions: {
      externalId: string
      amount: number  // cents
      date: string    // YYYY-MM-DD
      description: string
      merchant?: string
      pending: boolean
    }[]
  }[]
}> {
  // Build the accounts URL — fetch last 30 days of transactions
  const startDate = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)
  const url = `${accessUrl}/accounts?start-date=${startDate}`

  const rawData = await httpGet(url)
  const data: SimpleFINResponse = JSON.parse(rawData)

  if (data.errors && data.errors.length > 0) {
    throw new Error(`SimpleFIN errors: ${data.errors.join(', ')}`)
  }

  return {
    accounts: data.accounts.map(acct => ({
      externalId: acct.id,
      name: acct.name,
      institution: acct.org?.name || 'Unknown',
      accountType: inferAccountType(acct.name),
      balance: dollarsToCents(acct.balance),
      availableBalance: acct['available-balance'] ? dollarsToCents(acct['available-balance']) : undefined,
      currency: acct.currency || 'USD',
      transactions: (acct.transactions || []).map(tx => ({
        externalId: tx.id,
        amount: dollarsToCents(tx.amount),
        date: unixToDate(tx.posted),
        description: tx.description || tx.memo || '',
        merchant: tx.payee || undefined,
        pending: tx.pending || false,
      })),
    })),
  }
}

/** Convert a decimal dollar string to integer cents */
function dollarsToCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100)
}

/** Convert Unix timestamp to YYYY-MM-DD */
function unixToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split('T')[0]
}

/** Infer account type from the account name */
function inferAccountType(name: string): 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other' {
  const lower = name.toLowerCase()
  if (lower.includes('credit') || lower.includes('card')) return 'credit_card'
  if (lower.includes('checking') || lower.includes('share draft')) return 'checking'
  if (lower.includes('savings') || lower.includes('share savings')) return 'savings'
  if (lower.includes('loan') || lower.includes('auto')) return 'loan'
  if (lower.includes('mortgage')) return 'mortgage'
  if (lower.includes('invest') || lower.includes('brokerage') || lower.includes('401k') || lower.includes('ira')) return 'investment'
  return 'other'
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {} as Record<string, string>,
    }

    // SimpleFIN uses HTTP Basic Auth embedded in the URL
    if (parsedUrl.username) {
      const auth = Buffer.from(`${parsedUrl.username}:${parsedUrl.password}`).toString('base64')
      options.headers['Authorization'] = `Basic ${auth}`
    }

    const client = parsedUrl.protocol === 'https:' ? https : http
    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`SimpleFIN HTTP ${res.statusCode}: ${data}`))
        } else {
          resolve(data)
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('SimpleFIN request timeout')) })
    req.end()
  })
}

function httpPost(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: { 'Content-Length': '0' } as Record<string, string>,
    }

    const client = parsedUrl.protocol === 'https:' ? https : http
    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`SimpleFIN claim HTTP ${res.statusCode}: ${data}`))
        } else {
          resolve(data)
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('SimpleFIN claim timeout')) })
    req.end()
  })
}
