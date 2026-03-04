/**
 * Batch enrichment queue for outreach businesses.
 *
 * Iterates through a list of businesses, running social link discovery
 * and Apollo.io contact lookup with configurable rate limiting.
 */

import { getBusiness } from './outreach-db'
import { findSocialLinks } from './outreach-social'
import { searchApolloContacts } from './outreach-apollo'

export interface EnrichmentOptions {
  socialLinks: boolean
  contacts: boolean
  apolloApiKey?: string
  delayBetweenBusinesses?: number  // ms, default 2000
  delayBetweenRequests?: number    // ms, default 1000
}

export interface EnrichmentProgress {
  current: number
  total: number
  businessName: string
  phase: 'social' | 'contacts'
}

export interface EnrichmentResult {
  enriched: number
  socialLinksFound: number
  contactsFound: number
  errors: string[]
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Enrich a batch of businesses with social links and/or Apollo contacts.
 */
export async function enrichBusinesses(
  businessIds: string[],
  options: EnrichmentOptions,
  onProgress?: (info: EnrichmentProgress) => void,
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    enriched: 0,
    socialLinksFound: 0,
    contactsFound: 0,
    errors: [],
  }

  const delayBetween = options.delayBetweenBusinesses ?? 2000
  const delayRequests = options.delayBetweenRequests ?? 1000

  for (let i = 0; i < businessIds.length; i++) {
    const business = getBusiness(businessIds[i])
    if (!business) {
      result.errors.push(`Business ${businessIds[i]} not found`)
      continue
    }

    let didEnrich = false

    // Phase 1: Social links
    if (options.socialLinks) {
      onProgress?.({
        current: i + 1,
        total: businessIds.length,
        businessName: business.name,
        phase: 'social',
      })

      try {
        // Extract city from address (last part before state/zip)
        const city = business.address.split(',').slice(-2, -1)[0]?.trim() || ''
        const links = await findSocialLinks(business.website, business.name, city, business.id)
        const found = Object.values(links).filter(Boolean).length
        result.socialLinksFound += found
        if (found > 0) didEnrich = true
      } catch (err: any) {
        result.errors.push(`Social links for ${business.name}: ${err.message}`)
      }

      if (options.contacts) {
        await delay(delayRequests)
      }
    }

    // Phase 2: Apollo contacts
    if (options.contacts && options.apolloApiKey) {
      onProgress?.({
        current: i + 1,
        total: businessIds.length,
        businessName: business.name,
        phase: 'contacts',
      })

      try {
        const domain = business.website || business.name.toLowerCase().replace(/\s+/g, '') + '.com'
        const apollo = await searchApolloContacts(business.name, domain, options.apolloApiKey, business.id)
        result.contactsFound += apollo.contacts.length
        if (apollo.contacts.length > 0) didEnrich = true
      } catch (err: any) {
        result.errors.push(`Apollo for ${business.name}: ${err.message}`)
      }
    }

    if (didEnrich) result.enriched++

    // Rate limit between businesses
    if (i < businessIds.length - 1) {
      await delay(delayBetween)
    }
  }

  return result
}
