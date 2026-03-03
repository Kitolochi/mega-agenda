import {
  getSocialConnection,
  updateSocialConnection,
  createContactInteraction,
} from '../database'
import { matchOrCreateContact } from './matcher'
import type { SocialProviderInterface, SyncResult } from './types'
import { SMSProvider } from './sms'
import { DiscordProvider } from './discord'
import { TwitterProvider } from './twitter'
import { TelegramProvider } from './telegram'

function getProvider(provider: string, credentials: any): SocialProviderInterface {
  switch (provider) {
    case 'sms': return new SMSProvider(credentials)
    case 'discord': return new DiscordProvider(credentials)
    case 'twitter': return new TwitterProvider(credentials)
    case 'telegram': return new TelegramProvider(credentials)
    default: throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Sync a social connection: fetch contacts + interactions from the provider,
 * match/create contacts via ContactMatcher, and save interactions.
 */
export async function syncSocialConnection(
  connectionId: string
): Promise<{ newContacts: number; newInteractions: number }> {
  const conn = getSocialConnection(connectionId)
  if (!conn) throw new Error(`Social connection ${connectionId} not found`)

  // Mark as syncing
  updateSocialConnection(connectionId, { status: 'syncing' })

  try {
    const creds = JSON.parse(conn.credentials)
    const provider = getProvider(conn.provider, creds)

    const result: SyncResult = await provider.sync()

    let newContacts = 0
    let newInteractions = 0

    // Build externalId → contactId map
    const extToContact = new Map<string, string>()

    // Process contacts
    for (const ext of result.contacts) {
      const contactId = matchOrCreateContact(ext, conn.provider)
      extToContact.set(ext.externalId, contactId)
      // We count every contact processed — matchOrCreateContact handles dedup
      newContacts++
    }

    // Process interactions
    for (const interaction of result.interactions) {
      const contactId = extToContact.get(interaction.contactExternalId)
      if (!contactId) continue

      createContactInteraction({
        contactIds: [contactId],
        type: interaction.type,
        subject: `[${conn.provider}] ${interaction.subject}`,
        notes: interaction.body,
        date: interaction.date,
      })
      newInteractions++
    }

    // Mark as connected with sync timestamp
    updateSocialConnection(connectionId, {
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
    })

    return { newContacts, newInteractions }
  } catch (err: any) {
    console.error(`[social] Sync failed for ${conn.provider}:`, err.message)
    updateSocialConnection(connectionId, { status: 'error' })
    throw err
  }
}
