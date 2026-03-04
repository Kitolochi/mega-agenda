import https from 'https'
import { Business, createBusiness, getBusinesses } from './outreach-db'

// ── Types ──

interface LatLng {
  lat: number
  lng: number
}

interface PlaceResult {
  name: string
  formatted_address: string
  geometry: { location: LatLng }
  rating?: number
  user_ratings_total?: number
  types?: string[]
  place_id: string
}

interface TextSearchResponse {
  results: PlaceResult[]
  next_page_token?: string
  status: string
  error_message?: string
}

interface PlaceDetailsResponse {
  result: {
    formatted_phone_number?: string
    international_phone_number?: string
    website?: string
  }
  status: string
}

export interface DiscoveryResult {
  businesses: Business[]
  totalFound: number
  imported: number
  duplicatesSkipped: number
}

// ── HTTP helper ──

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
        } else {
          resolve(data)
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Text Search (paginated) ──

async function textSearch(
  query: string,
  location: LatLng,
  radiusMeters: number,
  apiKey: string
): Promise<PlaceResult[]> {
  const allResults: PlaceResult[] = []
  let pageToken: string | undefined

  // Google allows up to 3 pages (60 results)
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({
      query,
      location: `${location.lat},${location.lng}`,
      radius: String(radiusMeters),
      key: apiKey,
    })
    if (pageToken) params.set('pagetoken', pageToken)

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
    const raw = await httpsGet(url)
    const parsed: TextSearchResponse = JSON.parse(raw)

    if (parsed.status === 'ZERO_RESULTS') break
    if (parsed.status !== 'OK' && parsed.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API error: ${parsed.status} — ${parsed.error_message || ''}`)
    }

    allResults.push(...parsed.results)

    if (!parsed.next_page_token) break
    pageToken = parsed.next_page_token

    // Google requires ~2s before the next page token becomes valid
    await delay(2000)
  }

  return allResults
}

// ── Place Details (phone + website) ──

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<{ phone: string; website: string }> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'formatted_phone_number,international_phone_number,website',
    key: apiKey,
  })

  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  const raw = await httpsGet(url)
  const parsed: PlaceDetailsResponse = JSON.parse(raw)

  if (parsed.status !== 'OK') {
    return { phone: '', website: '' }
  }

  return {
    phone: parsed.result.formatted_phone_number || parsed.result.international_phone_number || '',
    website: parsed.result.website || '',
  }
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
    const key = buildDedupeKey(place.name, place.formatted_address)
    if (existingKeys.has(key)) {
      duplicatesSkipped++
      continue
    }

    // Fetch phone + website from Place Details
    const details = await fetchPlaceDetails(place.place_id, apiKey)

    const business = createBusiness({
      name: place.name,
      address: place.formatted_address,
      phone: details.phone,
      website: details.website,
      category: place.types?.[0] || '',
      source: 'google_places',
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
    })

    imported.push(business)
    // Mark as seen so subsequent results in same batch don't duplicate
    existingKeys.add(key)
  }

  return {
    businesses: imported,
    totalFound: places.length,
    imported: imported.length,
    duplicatesSkipped,
  }
}
