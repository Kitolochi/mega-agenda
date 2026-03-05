import https from 'https'
import { Business, createBusiness, getBusinesses } from './outreach-db'

// ── Types ──

interface LatLng {
  lat: number
  lng: number
}

interface PlaceResult {
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  types?: string[]
  id?: string
  websiteUri?: string
  nationalPhoneNumber?: string
}

interface TextSearchResponse {
  places?: PlaceResult[]
  nextPageToken?: string
  error?: { message: string; status: string }
}

export interface DiscoveryResult {
  businesses: Business[]
  totalFound: number
  imported: number
  duplicatesSkipped: number
}

// ── HTTP helper ──

function httpsPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers,
      },
      timeout: 30000,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`))
        } else {
          resolve(data)
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Text Search (New API) ──

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.websiteUri',
  'places.nationalPhoneNumber',
].join(',')

async function textSearch(
  query: string,
  location: LatLng,
  radiusMeters: number,
  apiKey: string
): Promise<PlaceResult[]> {
  const allResults: PlaceResult[] = []
  let pageToken: string | undefined

  // Up to 3 pages (60 results)
  for (let page = 0; page < 3; page++) {
    const requestBody: any = {
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: radiusMeters,
        },
      },
      pageSize: 20,
    }
    if (pageToken) requestBody.pageToken = pageToken

    const url = 'https://places.googleapis.com/v1/places:searchText'
    const raw = await httpsPost(url, JSON.stringify(requestBody), {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    })

    const parsed: TextSearchResponse = JSON.parse(raw)

    if (parsed.error) {
      throw new Error(`Places API error: ${parsed.error.status} — ${parsed.error.message}`)
    }

    if (!parsed.places || parsed.places.length === 0) break

    allResults.push(...parsed.places)

    if (!parsed.nextPageToken) break
    pageToken = parsed.nextPageToken

    // Brief delay between pages
    await delay(1000)
  }

  return allResults
}

// ── Deduplication ──

function buildDedupeKey(name: string, address: string): string {
  return `${name.toLowerCase().trim()}|${address.toLowerCase().trim()}`
}

function getExistingKeys(): Set<string> {
  const existing = getBusinesses()
  const keys = new Set<string>()
  for (const biz of existing) {
    keys.add(buildDedupeKey(biz.name, biz.address))
  }
  return keys
}

// ── Main discovery function ──

export async function searchBusinesses(
  query: string,
  location: LatLng,
  radiusMeters: number,
  apiKey: string
): Promise<DiscoveryResult> {
  const places = await textSearch(query, location, radiusMeters, apiKey)
  const existingKeys = getExistingKeys()

  const imported: Business[] = []
  let duplicatesSkipped = 0

  for (const place of places) {
    const name = place.displayName?.text || ''
    const address = place.formattedAddress || ''
    if (!name) continue

    const key = buildDedupeKey(name, address)
    if (existingKeys.has(key)) {
      duplicatesSkipped++
      continue
    }

    const business = createBusiness({
      name,
      address,
      phone: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      category: place.types?.[0] || '',
      source: 'google_places',
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      rating: place.rating ?? null,
      reviewCount: place.userRatingCount ?? null,
    })

    imported.push(business)
    existingKeys.add(key)
  }

  return {
    businesses: imported,
    totalFound: places.length,
    imported: imported.length,
    duplicatesSkipped,
  }
}
