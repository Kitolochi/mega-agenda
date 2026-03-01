import { ipcMain, BrowserWindow } from 'electron'
import {
  getBankConnections,
  createBankConnection,
  deleteBankConnection,
  getBankAccounts,
  getBankTransactions,
  getBankConnection,
} from '../database'
import { exchangeSetupToken } from '../bank-sync/simplefin'
import { syncConnection } from '../bank-sync/sync'

export function registerBankSyncHandlers(_mainWindow: BrowserWindow) {
  // Get all bank connections
  ipcMain.handle('get-bank-connections', () => {
    return getBankConnections()
  })

  // Connect a new bank
  ipcMain.handle('connect-bank', async (_, provider: 'simplefin' | 'teller', token: string) => {
    let accessToken = token

    if (provider === 'simplefin') {
      // Exchange setup token for access URL
      accessToken = await exchangeSetupToken(token)
    }

    // Create the connection
    const conn = createBankConnection(provider, accessToken)

    // Run initial sync
    try {
      await syncConnection(conn.id)
    } catch (err: any) {
      // Connection was created but sync failed — leave it in error state
      console.error('Initial bank sync failed:', err.message)
    }

    return getBankConnection(conn.id)
  })

  // Delete a bank connection
  ipcMain.handle('delete-bank-connection', (_, id: string) => {
    deleteBankConnection(id)
  })

  // Sync a single connection
  ipcMain.handle('sync-bank-connection', async (_, id: string) => {
    return await syncConnection(id)
  })

  // Sync all connections
  ipcMain.handle('sync-all-bank-connections', async () => {
    const connections = getBankConnections().filter(c => c.status !== 'disconnected')
    for (const conn of connections) {
      try {
        await syncConnection(conn.id)
      } catch (err: any) {
        console.error(`Sync failed for connection ${conn.id}:`, err.message)
      }
    }
  })

  // Get all bank accounts
  ipcMain.handle('get-bank-accounts', () => {
    return getBankAccounts()
  })

  // Get bank transactions
  ipcMain.handle('get-bank-transactions', (_, accountId?: string, limit?: number) => {
    return getBankTransactions(accountId, limit)
  })
}
