import { ipcMain, BrowserWindow } from 'electron'
import {
  getSocialConnections,
  getSocialConnection,
  createSocialConnection,
  updateSocialConnection,
  deleteSocialConnection,
  getContactMappings,
  deleteContactMapping,
} from '../database'
import { syncSocialConnection } from '../social/orchestrator'
import { telegramSendCode, telegramVerifyCode } from '../social/telegram'
import { detectPhoneLinkDb } from '../social/sms'
import { TwitterProvider } from '../social/twitter'

export function registerSocialHandlers(_mainWindow: BrowserWindow) {
  // Get all social connections
  ipcMain.handle('social-get-connections', () => {
    return getSocialConnections()
  })

  // Connect a social provider
  ipcMain.handle('social-connect-provider', async (_, provider: string, credentials: any) => {
    let accountId = ''
    let accountName = ''

    if (provider === 'sms') {
      accountId = 'phone-link'
      accountName = 'Phone Link SMS'
    } else if (provider === 'discord') {
      // Verify bot token
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${credentials.botToken}` },
      })
      if (!res.ok) throw new Error('Invalid Discord bot token')
      const user = await res.json()
      accountId = user.id
      accountName = `${user.username}#${user.discriminator || '0'}`
    } else if (provider === 'twitter') {
      const tp = new TwitterProvider()
      const info = await tp.connect()
      accountId = info.accountId
      accountName = info.accountName
      // Credentials = existing db.twitter, so store empty
      credentials = {}
    } else if (provider === 'telegram') {
      accountId = credentials.accountId
      accountName = credentials.accountName
    }

    const conn = createSocialConnection({
      provider: provider as any,
      accountId,
      accountName,
      status: 'connected',
      lastSyncAt: null,
      credentials: JSON.stringify(credentials),
    })

    return conn
  })

  // Disconnect a social provider
  ipcMain.handle('social-disconnect-provider', async (_, connectionId: string) => {
    updateSocialConnection(connectionId, { status: 'disconnected' })
  })

  // Delete a social connection
  ipcMain.handle('social-delete-connection', (_, connectionId: string) => {
    deleteSocialConnection(connectionId)
  })

  // Sync a social provider
  ipcMain.handle('social-sync-provider', async (_, connectionId: string) => {
    return await syncSocialConnection(connectionId)
  })

  // Get contact mappings
  ipcMain.handle('social-get-contact-mappings', (_, contactId?: string) => {
    return getContactMappings(contactId)
  })

  // Delete a contact mapping
  ipcMain.handle('social-delete-contact-mapping', (_, id: string) => {
    deleteContactMapping(id)
  })

  // Telegram: send verification code
  ipcMain.handle('social-telegram-send-code', async (_, phone: string, apiId: number, apiHash: string) => {
    return await telegramSendCode(phone, apiId, apiHash)
  })

  // Telegram: verify code
  ipcMain.handle('social-telegram-verify-code', async (_, phone: string, code: string, phoneCodeHash: string, apiId: number, apiHash: string) => {
    return await telegramVerifyCode(phone, code, phoneCodeHash, apiId, apiHash)
  })

  // SMS: auto-detect Phone Link DB
  ipcMain.handle('social-sms-detect-db', () => {
    return detectPhoneLinkDb()
  })

  // Get sync status for a connection
  ipcMain.handle('social-get-sync-status', (_, connectionId: string) => {
    const conn = getSocialConnection(connectionId)
    if (!conn) return { status: 'disconnected', lastSyncAt: null }
    return { status: conn.status, lastSyncAt: conn.lastSyncAt }
  })

  // Twitter: sync contacts (uses existing OAuth from Settings)
  ipcMain.handle('social-twitter-sync-contacts', async () => {
    // Find or create a twitter social connection
    let conn = getSocialConnections().find(c => c.provider === 'twitter')
    if (!conn) {
      const tp = new TwitterProvider()
      const info = await tp.connect()
      conn = createSocialConnection({
        provider: 'twitter',
        accountId: info.accountId,
        accountName: info.accountName,
        status: 'connected',
        lastSyncAt: null,
        credentials: JSON.stringify({}),
      })
    }
    return await syncSocialConnection(conn.id)
  })
}
