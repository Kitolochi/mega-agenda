/**
 * High-level outreach scraper module.
 *
 * Orchestrates Yelp and Charlotte Chamber scraping via the scrapling-bridge,
 * transforms results into business records, deduplicates, and inserts into
 * the outreach database.
 */

import {
  sendScrapingCommand,
  type BusinessesResponse,
  type ErrorResponse,
  type ScrapingResponse,
} from './scrapling-bridge'
import { createBusiness, getBusinesses, type Business } from './outreach-db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeStats {
  found: number
  imported: number
  duplicatesSkipped: number
}

interface ScrapedBusiness {
  name: string
  url: string
  rating?: string
  reviewCount?: string
  phone?: string
  address?: string
  website?: string
  category?: string
  source?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeForDedup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildDedupKey(name: string, address: string): string {
  return `${normalizeForDedup(name)}::${normalizeForDedup(address)}`
}

function buildExistingKeys(existing: Business[]): Set<string> {
  const keys = new Set<string>()
  for (const biz of existing) {
    keys.add(buildDedupKey(biz.name, biz.address))
  }
  return keys
}

function isErrorResponse(resp: ScrapingResponse): resp is ErrorResponse {
  return 'error' in resp
}

function isBusinessesResponse(resp: ScrapingResponse): resp is BusinessesResponse {
  return 'businesses' in resp
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const n = parseFloat(value)
  return isNaN(n) ? null : n
}

function importBusinesses(
  scraped: ScrapedBusiness[],
  source: string,
  existingKeys: Set<string>,
): ScrapeStats {
  const stats: ScrapeStats = { found: scraped.length, imported: 0, duplicatesSkipped: 0 }

  for (const biz of scraped) {
    const key = buildDedupKey(biz.name, biz.address ?? '')
    if (existingKeys.has(key)) {
      stats.duplicatesSkipped++
      continue
    }

    createBusiness({
      name: biz.name,
      address: biz.address ?? '',
      phone: biz.phone ?? '',
      website: biz.website ?? biz.url ?? '',
      category: biz.category ?? '',
      source,
      rating: parseNumber(biz.rating),
      reviewCount: biz.reviewCount ? parseInt(biz.reviewCount, 10) || null : null,
      socialLinks: biz.url ? { yelp: biz.url } : {},
    })

    existingKeys.add(key)
    stats.imported++
  }

  return stats
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scrapeYelpBusinesses(
  category: string,
  location: string = 'Charlotte NC',
  limit: number = 20,
): Promise<ScrapeStats> {
  const resp = await sendScrapingCommand({
    cmd: 'scrape_yelp',
    category,
    location,
    limit,
  }, 120_000)

  if (isErrorResponse(resp)) {
    throw new Error(`Yelp scrape failed: ${resp.error}`)
  }
  if (!isBusinessesResponse(resp)) {
    throw new Error('Unexpected response from scrape_yelp')
  }

  const existing = getBusinesses()
  const existingKeys = buildExistingKeys(existing)

  return importBusinesses(resp.businesses as ScrapedBusiness[], 'yelp', existingKeys)
}

export async function scrapeChamberDirectory(): Promise<ScrapeStats> {
  const resp = await sendScrapingCommand({
    cmd: 'scrape_directory',
    url: 'https://directory.charlotteareachamber.com/memberdirectory',
  }, 120_000)

  if (isErrorResponse(resp)) {
    throw new Error(`Chamber scrape failed: ${resp.error}`)
  }
  if (!isBusinessesResponse(resp)) {
    throw new Error('Unexpected response from scrape_directory')
  }

  const existing = getBusinesses()
  const existingKeys = buildExistingKeys(existing)

  return importBusinesses(resp.businesses as ScrapedBusiness[], 'chamber', existingKeys)
}
