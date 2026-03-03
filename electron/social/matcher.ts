import {
  getContactMappings,
  createContactMapping,
  getNetworkContacts,
  createNetworkContact,
} from '../database'
import type { ExternalContact } from './types'

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^1/, '')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Match an external contact to an existing NetworkContact, or create a new one.
 * Returns the matched/created contactId.
 *
 * Matching priority:
 * 1. ContactMapping table: externalId + provider already mapped
 * 2. Phone number match (normalized)
 * 3. Email match (normalized)
 * 4. No match → create new contact + mapping
 */
export function matchOrCreateContact(
  ext: ExternalContact,
  provider: 'telegram' | 'discord' | 'twitter' | 'sms'
): string {
  // 1. Check existing mapping
  const allMappings = getContactMappings()
  const existingMapping = allMappings.find(
    m => m.provider === provider && m.externalId === ext.externalId
  )
  if (existingMapping) {
    return existingMapping.contactId
  }

  const contacts = getNetworkContacts()

  // 2. Phone match
  if (ext.phone) {
    const normPhone = normalizePhone(ext.phone)
    if (normPhone.length >= 7) {
      const phoneMatch = contacts.find(c => {
        if (!c.phone) return false
        return normalizePhone(c.phone) === normPhone
      })
      if (phoneMatch) {
        createContactMapping({
          contactId: phoneMatch.id,
          provider,
          externalId: ext.externalId,
          externalName: ext.name || ext.username || '',
        })
        return phoneMatch.id
      }
    }
  }

  // 3. Email match
  if (ext.email) {
    const normEmail = normalizeEmail(ext.email)
    const emailMatch = contacts.find(c => {
      if (!c.email) return false
      return normalizeEmail(c.email) === normEmail
    })
    if (emailMatch) {
      createContactMapping({
        contactId: emailMatch.id,
        provider,
        externalId: ext.externalId,
        externalName: ext.name || ext.username || '',
      })
      return emailMatch.id
    }
  }

  // 4. No match → create new contact
  const socialLinks: Record<string, string> = {}
  if (provider === 'twitter' && ext.username) socialLinks.twitter = ext.username
  if (provider === 'discord' && ext.username) socialLinks.discord = ext.username

  const newContact = createNetworkContact({
    name: ext.name || ext.username || ext.externalId,
    company: '',
    role: '',
    email: ext.email || '',
    phone: ext.phone || '',
    socialLinks,
    notes: '',
    tags: [`via-${provider}`],
    avatarColor: '',
  })

  createContactMapping({
    contactId: newContact.id,
    provider,
    externalId: ext.externalId,
    externalName: ext.name || ext.username || '',
  })

  return newContact.id
}
