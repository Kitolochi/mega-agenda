import crypto from 'crypto'
import { getTwitterSettings } from '../database'
import type { SocialProviderInterface, SyncResult, ExternalContact, ExternalInteraction } from './types'

/**
 * Twitter Provider — extends existing OAuth 1.0a credentials to import followers/following + DMs.
 */
export class TwitterProvider implements SocialProviderInterface {
  private settings: ReturnType<typeof getTwitterSettings> | null = null

  constructor(_credentials?: any) {
    // Credentials come from existing db.twitter settings
  }

  private getOAuthSettings() {
    const settings = getTwitterSettings()
    if (!settings.apiKey || !settings.accessToken) {
      throw new Error('Twitter OAuth not configured. Set up Twitter in Settings first.')
    }
    return settings
  }

  /**
   * Generate OAuth 1.0a signature for Twitter API v2
   */
  private generateOAuthHeader(method: string, url: string): string {
    const settings = this.getOAuthSettings()
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: settings.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: settings.accessToken,
      oauth_version: '1.0',
    }

    // Create signature base string
    const paramString = Object.keys(oauthParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
      .join('&')

    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
    const signingKey = `${encodeURIComponent(settings.apiSecret)}&${encodeURIComponent(settings.accessTokenSecret)}`

    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')
    oauthParams.oauth_signature = signature

    const header = Object.keys(oauthParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ')

    return `OAuth ${header}`
  }

  private async twitterApi(endpoint: string): Promise<any> {
    const url = `https://api.twitter.com${endpoint}`
    const authHeader = this.generateOAuthHeader('GET', url.split('?')[0])

    const res = await fetch(url, {
      headers: { Authorization: authHeader },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Twitter API error ${res.status}: ${text}`)
    }

    await new Promise(r => setTimeout(r, 100))
    return res.json()
  }

  async connect(_credentials?: any): Promise<{ accountId: string; accountName: string }> {
    const settings = this.getOAuthSettings()
    return {
      accountId: settings.userId || 'twitter-user',
      accountName: settings.username ? `@${settings.username}` : 'Twitter',
    }
  }

  async disconnect(): Promise<void> {
    // No-op — uses existing Settings OAuth
  }

  async sync(): Promise<SyncResult> {
    const settings = this.getOAuthSettings()
    const contacts: ExternalContact[] = []
    const interactions: ExternalInteraction[] = []
    const seenUsers = new Set<string>()

    // Fetch following
    try {
      const userId = settings.userId
      if (userId) {
        const following = await this.twitterApi(`/2/users/${userId}/following?max_results=100&user.fields=name,username`)
        if (following.data) {
          for (const user of following.data) {
            if (seenUsers.has(user.id)) continue
            seenUsers.add(user.id)
            contacts.push({
              externalId: user.id,
              name: user.name,
              username: user.username,
            })
          }
        }
      }
    } catch (err: any) {
      console.warn('[twitter] Failed to fetch following:', err.message)
    }

    // Fetch followers
    try {
      const userId = settings.userId
      if (userId) {
        const followers = await this.twitterApi(`/2/users/${userId}/followers?max_results=100&user.fields=name,username`)
        if (followers.data) {
          for (const user of followers.data) {
            if (seenUsers.has(user.id)) continue
            seenUsers.add(user.id)
            contacts.push({
              externalId: user.id,
              name: user.name,
              username: user.username,
            })
          }
        }
      }
    } catch (err: any) {
      console.warn('[twitter] Failed to fetch followers:', err.message)
    }

    // Fetch DMs
    try {
      const dms = await this.twitterApi('/2/dm_events?max_results=50&event_fields=created_at,text,sender_id,dm_conversation_id')
      if (dms.data) {
        for (const event of dms.data) {
          if (!event.text) continue
          const preview = event.text.length > 100 ? event.text.slice(0, 100) + '...' : event.text

          interactions.push({
            externalId: event.id,
            contactExternalId: event.sender_id,
            type: 'message',
            subject: 'Twitter DM',
            body: preview,
            date: event.created_at || new Date().toISOString(),
          })
        }
      }
    } catch (err: any) {
      console.warn('[twitter] Failed to fetch DMs:', err.message)
    }

    return { contacts, interactions }
  }
}
