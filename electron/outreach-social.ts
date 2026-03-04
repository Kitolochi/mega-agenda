/**
 * Social media link finder for outreach businesses.
 *
 * Step 1: Scrape the business website directly for social links.
 * Step 2: Fall back to Google search for any missing platforms.
 */

import {
  sendScrapingCommand,
  SocialLinksResponse,
  SearchResultsResponse,
  ErrorResponse,
} from './scrapling-bridge'
import { getBusiness, updateBusiness } from './outreach-db'

export interface SocialLinksResult {
  linkedin?: string
  facebook?: string
  instagram?: string
  twitter?: string
}

const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'twitter'] as const

function isSocialLinksResponse(resp: any): resp is SocialLinksResponse {
  return resp && typeof resp === 'object' && 'social' in resp
}

function isSearchResultsResponse(resp: any): resp is SearchResultsResponse {
  return resp && typeof resp === 'object' && 'results' in resp
}

function isErrorResponse(resp: any): resp is ErrorResponse {
  return resp && typeof resp === 'object' && 'error' in resp
}

/**
 * Extract a social media URL from Google search results for a given platform.
 */
function extractPlatformUrl(results: { url: string; title: string }[], platform: string): string | undefined {
  const domainMap: Record<string, string[]> = {
    linkedin: ['linkedin.com'],
    facebook: ['facebook.com'],
    instagram: ['instagram.com'],
    twitter: ['twitter.com', 'x.com'],
  }

  const domains = domainMap[platform] || []
  for (const result of results) {
    const lower = result.url.toLowerCase()
    if (domains.some(d => lower.includes(d))) {
      return result.url
    }
  }
  return undefined
}

/**
 * Find social media links for a business.
 *
 * 1. Scrape the business website for social links.
 * 2. For any missing platforms, search Google.
 * 3. Update the business record with found links.
 */
export async function findSocialLinks(
  businessWebsite: string,
  businessName: string,
  city: string,
  businessId?: string,
): Promise<SocialLinksResult> {
  const result: SocialLinksResult = {}

  // Step 1: Scrape the business website directly
  if (businessWebsite) {
    const resp = await sendScrapingCommand({ cmd: 'scrape_social_links', url: businessWebsite })

    if (isSocialLinksResponse(resp)) {
      for (const platform of PLATFORMS) {
        if (resp.social[platform]) {
          result[platform] = resp.social[platform]
        }
      }
    } else if (isErrorResponse(resp)) {
      console.warn(`[outreach-social] scrape_social_links error: ${resp.error}`)
    }
  }

  // Step 2: Google search for missing platforms
  const missing = PLATFORMS.filter(p => !result[p])

  for (const platform of missing) {
    const query = `${businessName} ${city} ${platform}`
    const resp = await sendScrapingCommand({ cmd: 'scrape_google_search', query })

    if (isSearchResultsResponse(resp)) {
      const url = extractPlatformUrl(resp.results, platform)
      if (url) {
        result[platform] = url
      }
    } else if (isErrorResponse(resp)) {
      console.warn(`[outreach-social] Google search error for ${platform}: ${resp.error}`)
    }
  }

  // Update the business record if we have an ID
  if (businessId) {
    const business = getBusiness(businessId)
    if (business) {
      const merged = { ...business.socialLinks }
      for (const platform of PLATFORMS) {
        if (result[platform]) {
          merged[platform] = result[platform]!
        }
      }
      updateBusiness(businessId, { socialLinks: merged })
    }
  }

  return result
}
