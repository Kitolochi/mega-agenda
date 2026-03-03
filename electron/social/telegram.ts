import type { SocialProviderInterface, SyncResult, ExternalContact, ExternalInteraction } from './types'

/**
 * Telegram Provider — uses GramJS (MTProto) for user API access.
 * Requires api_id + api_hash from my.telegram.org and phone + OTP verification.
 */
export class TelegramProvider implements SocialProviderInterface {
  private session: string
  private apiId: number
  private apiHash: string

  constructor(credentials: { session: string; apiId: number; apiHash: string }) {
    this.session = credentials.session || ''
    this.apiId = credentials.apiId
    this.apiHash = credentials.apiHash
  }

  private async getClient() {
    const { TelegramClient } = await import('telegram')
    const { StringSession } = await import('telegram/sessions')
    const client = new TelegramClient(
      new StringSession(this.session),
      this.apiId,
      this.apiHash,
      { connectionRetries: 3 }
    )
    await client.connect()
    return client
  }

  async connect(credentials: { session: string; apiId: number; apiHash: string }): Promise<{ accountId: string; accountName: string }> {
    this.session = credentials.session
    this.apiId = credentials.apiId
    this.apiHash = credentials.apiHash

    const client = await this.getClient()
    try {
      const me = await client.getMe() as any
      return {
        accountId: String(me.id),
        accountName: me.username ? `@${me.username}` : me.firstName || 'Telegram User',
      }
    } finally {
      await client.disconnect()
    }
  }

  async disconnect(): Promise<void> {
    // Session string is stateless — just clear it
    this.session = ''
  }

  async sync(): Promise<SyncResult> {
    const client = await this.getClient()
    const contacts: ExternalContact[] = []
    const interactions: ExternalInteraction[] = []
    const seenUsers = new Set<string>()

    try {
      // Fetch dialogs (conversations)
      const dialogs = await client.getDialogs({ limit: 50 })

      for (const dialog of dialogs) {
        const entity = dialog.entity as any
        if (!entity) continue

        // Only process users, not groups/channels
        const isUser = entity.className === 'User'
        if (!isUser || entity.bot) continue

        const externalId = String(entity.id)
        if (seenUsers.has(externalId)) continue
        seenUsers.add(externalId)

        contacts.push({
          externalId,
          name: [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.username || externalId,
          phone: entity.phone || undefined,
          username: entity.username || undefined,
        })

        // Fetch recent messages from this dialog
        try {
          const messages = await client.getMessages(entity, { limit: 5 })
          for (const msg of messages) {
            if (!msg.message) continue
            const preview = msg.message.length > 100 ? msg.message.slice(0, 100) + '...' : msg.message

            interactions.push({
              externalId: `tg-${msg.id}`,
              contactExternalId: externalId,
              type: 'message',
              subject: `Telegram chat with ${entity.firstName || entity.username || 'user'}`,
              body: preview,
              date: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
            })
          }
        } catch {
          // Skip if we can't read messages
        }
      }
    } finally {
      await client.disconnect()
    }

    return { contacts, interactions }
  }
}

/**
 * Send verification code to phone number.
 * Returns phoneCodeHash needed for verification step.
 */
export async function telegramSendCode(
  phone: string,
  apiId: number,
  apiHash: string
): Promise<{ phoneCodeHash: string }> {
  const { TelegramClient } = await import('telegram')
  const { StringSession } = await import('telegram/sessions')

  const client = new TelegramClient(
    new StringSession(''),
    apiId,
    apiHash,
    { connectionRetries: 3 }
  )
  await client.connect()

  try {
    const result = await client.sendCode(
      { apiId, apiHash },
      phone
    )
    // Disconnect but don't destroy — we'll reconnect for verify
    await client.disconnect()
    return { phoneCodeHash: result.phoneCodeHash }
  } catch (err) {
    await client.disconnect()
    throw err
  }
}

/**
 * Verify OTP code and return session string for persistence.
 */
export async function telegramVerifyCode(
  phone: string,
  code: string,
  phoneCodeHash: string,
  apiId: number,
  apiHash: string
): Promise<{ session: string; accountId: string; accountName: string }> {
  const { TelegramClient } = await import('telegram')
  const { StringSession } = await import('telegram/sessions')

  const stringSession = new StringSession('')
  const client = new TelegramClient(
    stringSession,
    apiId,
    apiHash,
    { connectionRetries: 3 }
  )
  await client.connect()

  try {
    await client.invoke(
      new (await import('telegram/tl')).Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      })
    )

    const me = await client.getMe() as any
    const session = stringSession.save()

    await client.disconnect()

    return {
      session,
      accountId: String(me.id),
      accountName: me.username ? `@${me.username}` : me.firstName || 'Telegram User',
    }
  } catch (err) {
    await client.disconnect()
    throw err
  }
}
