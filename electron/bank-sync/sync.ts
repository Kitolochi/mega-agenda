import crypto from 'crypto'
import {
  getBankConnection,
  updateBankConnection,
  upsertBankAccount,
  upsertBankTransaction,
  type BankAccount,
  type BankTransaction
} from '../database'
import * as simplefin from './simplefin'
import * as teller from './teller'

/**
 * Sync a single bank connection — fetches accounts, balances, and transactions.
 * Returns the synced accounts and count of new transactions.
 */
export async function syncConnection(connectionId: string): Promise<{ accounts: BankAccount[]; newTransactions: number }> {
  const conn = getBankConnection(connectionId)
  if (!conn) throw new Error(`Bank connection ${connectionId} not found`)
  if (conn.status === 'disconnected') throw new Error('Connection is disconnected')

  try {
    let fetchResult: {
      accounts: {
        externalId: string
        name: string
        institution: string
        accountType: BankAccount['accountType']
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
    }

    // Fetch from provider
    if (conn.provider === 'simplefin') {
      fetchResult = await simplefin.fetchAccounts(conn.accessToken)
    } else {
      fetchResult = await teller.fetchAccounts(conn.accessToken)
    }

    const syncedAccounts: BankAccount[] = []
    let newTxCount = 0

    for (const extAcct of fetchResult.accounts) {
      // Upsert account
      const account = upsertBankAccount({
        id: crypto.randomUUID(),
        connectionId: conn.id,
        externalId: extAcct.externalId,
        name: extAcct.name,
        institution: extAcct.institution,
        accountType: extAcct.accountType,
        balance: extAcct.balance,
        availableBalance: extAcct.availableBalance,
        currency: extAcct.currency,
        lastSynced: new Date().toISOString(),
      })
      syncedAccounts.push(account)

      // Import transactions with deduplication
      for (const tx of extAcct.transactions) {
        const dedupHash = generateDedupHash(account.id, tx.date, tx.amount, tx.description)
        const result = upsertBankTransaction({
          id: crypto.randomUUID(),
          accountId: account.id,
          externalId: tx.externalId,
          dedupHash,
          amount: tx.amount,
          date: tx.date,
          description: tx.description,
          merchant: tx.merchant,
          pending: tx.pending,
          importedAt: new Date().toISOString(),
        })
        if (result.inserted) newTxCount++
      }
    }

    // Mark connection as synced
    updateBankConnection(conn.id, {
      status: 'active',
      lastSynced: new Date().toISOString(),
      errorMessage: undefined,
    })

    return { accounts: syncedAccounts, newTransactions: newTxCount }
  } catch (err: any) {
    // Mark connection as errored
    updateBankConnection(conn.id, {
      status: 'error',
      errorMessage: err.message || 'Sync failed',
    })
    throw err
  }
}

/**
 * Generate a deduplication hash for a transaction.
 * Uses account ID + date + amount + description to create a unique fingerprint.
 */
function generateDedupHash(accountId: string, date: string, amount: number, description: string): string {
  const input = `${accountId}|${date}|${amount}|${description}`
  return crypto.createHash('md5').update(input).digest('hex')
}
