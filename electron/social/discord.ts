import type { SocialProviderInterface, SyncResult, ExternalContact, ExternalInteraction } from './types'

const DISCORD_API = 'https://discord.com/api/v10'

/**
 * Discord Provider — uses bot token to fetch server members and DM history.
 */
export class DiscordProvider implements SocialProviderInterface {
  private botToken: string

  constructor(credentials: { botToken: string }) {
    this.botToken = credentials.botToken
  }

  private async api(endpoint: string): Promise<any> {
    const res = await fetch(`${DISCORD_API}${endpoint}`, {
      headers: { Authorization: `Bot ${this.botToken}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Discord API error ${res.status}: ${text}`)
    }
    // Rate limit: simple delay
    await new Promise(r => setTimeout(r, 50))
    return res.json()
  }

  async connect(credentials: { botToken: string }): Promise<{ accountId: string; accountName: string }> {
    this.botToken = credentials.botToken
    const user = await this.api('/users/@me')
    return {
      accountId: user.id,
      accountName: `${user.username}#${user.discriminator || '0'}`,
    }
  }

  async disconnect(): Promise<void> {
    // No-op — token-based, no session to tear down
  }

  async sync(): Promise<SyncResult> {
    const contacts: ExternalContact[] = []
    const interactions: ExternalInteraction[] = []
    const seenUsers = new Set<string>()

    // Fetch guilds the bot is in
    const guilds: any[] = await this.api('/users/@me/guilds')

    // Fetch members from each guild (limited to first 100 per guild)
    for (const guild of guilds.slice(0, 10)) {
      try {
        const members: any[] = await this.api(`/guilds/${guild.id}/members?limit=100`)
        for (const member of members) {
          const user = member.user
          if (!user || user.bot || seenUsers.has(user.id)) continue
          seenUsers.add(user.id)

          contacts.push({
            externalId: user.id,
            name: member.nick || user.global_name || user.username,
            username: user.username,
          })
        }
      } catch (err: any) {
        console.warn(`[discord] Failed to fetch members for guild ${guild.name}:`, err.message)
      }
    }

    // Fetch DM channels
    try {
      const channels: any[] = await this.api('/users/@me/channels')

      for (const channel of channels.slice(0, 20)) {
        if (channel.type !== 1) continue // Only direct messages

        const recipientId = channel.recipients?.[0]?.id
        if (!recipientId) continue

        // Ensure recipient is in contacts
        if (!seenUsers.has(recipientId)) {
          const recipient = channel.recipients[0]
          seenUsers.add(recipientId)
          contacts.push({
            externalId: recipientId,
            name: recipient.global_name || recipient.username,
            username: recipient.username,
          })
        }

        // Fetch recent messages from this DM
        try {
          const messages: any[] = await this.api(`/channels/${channel.id}/messages?limit=10`)
          for (const msg of messages) {
            if (!msg.content) continue
            const preview = msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content

            interactions.push({
              externalId: msg.id,
              contactExternalId: recipientId,
              type: 'message',
              subject: `DM with ${channel.recipients[0]?.username || 'user'}`,
              body: preview,
              date: msg.timestamp,
            })
          }
        } catch {
          // Skip channels we can't read
        }
      }
    } catch (err: any) {
      console.warn('[discord] Failed to fetch DM channels:', err.message)
    }

    return { contacts, interactions }
  }
}
