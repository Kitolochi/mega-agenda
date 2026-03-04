import { searchBusinesses, DiscoveryResult } from './outreach-discovery'
import { getOutreachSetting } from './outreach-db'

const CHARLOTTE_CATEGORIES = [
  'marketing agency',
  'real estate firm',
  'law office',
  'dental practice',
  'medical practice',
  'restaurant',
  'construction company',
  'accounting firm',
  'IT services',
]

export interface SeedProgress {
  category: string
  categoryIndex: number
  totalCategories: number
  imported: number
  totalImported: number
}

export async function seedCharlotteBusinesses(
  onProgress?: (progress: SeedProgress) => void
): Promise<{ totalImported: number; categories: number }> {
  const apiKey = getOutreachSetting('google_places_api_key')
  if (!apiKey) {
    throw new Error('Google Places API key is not configured')
  }

  const lat = parseFloat(getOutreachSetting('default_lat') || '35.2271')
  const lng = parseFloat(getOutreachSetting('default_lng') || '-80.8431')
  const radius = parseInt(getOutreachSetting('default_radius') || '25000', 10)

  let totalImported = 0

  for (let i = 0; i < CHARLOTTE_CATEGORIES.length; i++) {
    const category = CHARLOTTE_CATEGORIES[i]

    let result: DiscoveryResult
    try {
      result = await searchBusinesses(
        `${category} Charlotte NC`,
        { lat, lng },
        radius,
        apiKey
      )
    } catch (err) {
      console.error(`[outreach-seed] Failed to seed "${category}":`, err)
      continue
    }

    totalImported += result.imported

    onProgress?.({
      category,
      categoryIndex: i + 1,
      totalCategories: CHARLOTTE_CATEGORIES.length,
      imported: result.imported,
      totalImported,
    })
  }

  return { totalImported, categories: CHARLOTTE_CATEGORIES.length }
}
