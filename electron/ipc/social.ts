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
import { startChatGPTOAuth, refreshChatGPTTokens, decodeJWTPayload } from '../social/chatgpt'

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

  // ChatGPT OAuth: start
  ipcMain.handle('chatgpt-oauth-start', async () => {
    const result = await startChatGPTOAuth()
    const expiresAt = new Date(Date.now() + result.tokens.expires_in * 1000).toISOString()

    // Remove any existing chatgpt connection
    const existing = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (existing) deleteSocialConnection(existing.id)

    createSocialConnection({
      provider: 'chatgpt',
      accountId: result.profile.sub,
      accountName: result.profile.name,
      status: 'connected',
      lastSyncAt: null,
      credentials: JSON.stringify({
        access_token: result.tokens.access_token,
        refresh_token: result.tokens.refresh_token,
        id_token: result.tokens.id_token,
        expires_at: expiresAt,
        profile: result.profile,
      }),
    })

    return { connected: true, profile: result.profile }
  })

  // ChatGPT OAuth: disconnect
  ipcMain.handle('chatgpt-oauth-disconnect', () => {
    const conn = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (conn) deleteSocialConnection(conn.id)
  })

  // ChatGPT OAuth: status
  ipcMain.handle('chatgpt-oauth-status', () => {
    const conn = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (!conn || conn.status !== 'connected') return { connected: false }
    const creds = JSON.parse(conn.credentials)
    return {
      connected: true,
      profile: creds.profile,
      expiresAt: creds.expires_at,
    }
  })

  // ChatGPT OAuth: refresh
  ipcMain.handle('chatgpt-oauth-refresh', async () => {
    const conn = getSocialConnections().find(c => c.provider === 'chatgpt')
    if (!conn) throw new Error('No ChatGPT connection found')
    const creds = JSON.parse(conn.credentials)
    const tokens = await refreshChatGPTTokens(creds.refresh_token)
    const profile = decodeJWTPayload(tokens.id_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    updateSocialConnection(conn.id, {
      credentials: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        expires_at: expiresAt,
        profile: {
          sub: profile.sub || '',
          name: profile.name || profile.email || 'ChatGPT User',
          email: profile.email || '',
        },
      }),
    })

    return { refreshed: true }
  })
}
