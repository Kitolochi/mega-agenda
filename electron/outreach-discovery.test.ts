import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Node.js https module
vi.mock('https', () => ({
  default: {
    get: vi.fn(),
  },
}))

// Mock electron (transitive dep of outreach-db)
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}))

// Mock better-sqlite3 (transitive dep of outreach-db)
vi.mock('better-sqlite3', () => ({
  default: vi.fn(),
}))

// Mock outreach-db
vi.mock('./outreach-db', () => ({
  getBusinesses: vi.fn(() => []),
  createBusiness: vi.fn((data: any) => ({
    id: 'test-id',
    ...data,
    socialLinks: {},
    status: 'New',
    notes: '',
    createdAt: '2026-03-04T00:00:00.000Z',
    updatedAt: '2026-03-04T00:00:00.000Z',
  })),
}))

import https from 'https'
import { getBusinesses, createBusiness } from './outreach-db'
import { searchBusinesses } from './outreach-discovery'

// Helper to mock https.get responses
function mockHttpsGet(responses: Record<string, string>) {
  ;(https.get as any).mockImplementation((url: string, callback: any) => {
    const matchedKey = Object.keys(responses).find((key) => url.includes(key))
    const body = matchedKey ? responses[matchedKey] : '{"status":"UNKNOWN"}'

    const res = {
      statusCode: 200,
      on: vi.fn((event: string, handler: any) => {
        if (event === 'data') handler(body)
        if (event === 'end') handler()
        return res
      }),
    }
    callback(res)

    return {
      on: vi.fn(),
      setTimeout: vi.fn(),
    }
  })
}

describe('searchBusinesses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getBusinesses as any).mockReturnValue([])
  })

  it('parses text search results and calls place details', async () => {
    const textSearchResult = {
      results: [
        {
          name: 'Acme Marketing',
          formatted_address: '123 Main St, Charlotte, NC 28202',
          geometry: { location: { lat: 35.227, lng: -80.843 } },
          rating: 4.5,
          user_ratings_total: 120,
          types: ['marketing_agency', 'point_of_interest'],
          place_id: 'ChIJtest123',
        },
      ],
      status: 'OK',
    }

    const detailsResult = {
      result: {
        formatted_phone_number: '(704) 555-1234',
        website: 'https://acmemarketing.com',
      },
      status: 'OK',
    }

    mockHttpsGet({
      'textsearch': JSON.stringify(textSearchResult),
      'details': JSON.stringify(detailsResult),
    })

    const result = await searchBusinesses(
      'marketing agencies',
      { lat: 35.2271, lng: -80.8431 },
      40233,
      'test-api-key'
    )

    expect(result.totalFound).toBe(1)
    expect(result.imported).toBe(1)
    expect(result.duplicatesSkipped).toBe(0)
    expect(createBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme Marketing',
        address: '123 Main St, Charlotte, NC 28202',
        phone: '(704) 555-1234',
        website: 'https://acmemarketing.com',
        category: 'marketing_agency',
        source: 'google_places',
        lat: 35.227,
        lng: -80.843,
        rating: 4.5,
        reviewCount: 120,
      })
    )
  })

  it('skips duplicates already in the database', async () => {
    ;(getBusinesses as any).mockReturnValue([
      { name: 'Acme Marketing', address: '123 Main St, Charlotte, NC 28202' },
    ])

    const textSearchResult = {
      results: [
        {
          name: 'Acme Marketing',
          formatted_address: '123 Main St, Charlotte, NC 28202',
          geometry: { location: { lat: 35.227, lng: -80.843 } },
          types: ['marketing_agency'],
          place_id: 'ChIJtest123',
        },
      ],
      status: 'OK',
    }

    mockHttpsGet({
      'textsearch': JSON.stringify(textSearchResult),
    })

    const result = await searchBusinesses(
      'marketing agencies',
      { lat: 35.2271, lng: -80.8431 },
      40233,
      'test-api-key'
    )

    expect(result.totalFound).toBe(1)
    expect(result.imported).toBe(0)
    expect(result.duplicatesSkipped).toBe(1)
    expect(createBusiness).not.toHaveBeenCalled()
  })

  it('handles ZERO_RESULTS gracefully', async () => {
    mockHttpsGet({
      'textsearch': JSON.stringify({ results: [], status: 'ZERO_RESULTS' }),
    })

    const result = await searchBusinesses(
      'nonexistent query',
      { lat: 35.2271, lng: -80.8431 },
      40233,
      'test-api-key'
    )

    expect(result.totalFound).toBe(0)
    expect(result.imported).toBe(0)
  })

  it('deduplicates within the same batch', async () => {
    const textSearchResult = {
      results: [
        {
          name: 'Acme Marketing',
          formatted_address: '123 Main St, Charlotte, NC 28202',
          geometry: { location: { lat: 35.227, lng: -80.843 } },
          types: ['marketing_agency'],
          place_id: 'ChIJtest123',
        },
        {
          name: 'Acme Marketing',
          formatted_address: '123 Main St, Charlotte, NC 28202',
          geometry: { location: { lat: 35.227, lng: -80.843 } },
          types: ['marketing_agency'],
          place_id: 'ChIJtest456',
        },
      ],
      status: 'OK',
    }

    const detailsResult = {
      result: { formatted_phone_number: '', website: '' },
      status: 'OK',
    }

    mockHttpsGet({
      'textsearch': JSON.stringify(textSearchResult),
      'details': JSON.stringify(detailsResult),
    })

    const result = await searchBusinesses(
      'marketing agencies',
      { lat: 35.2271, lng: -80.8431 },
      40233,
      'test-api-key'
    )

    expect(result.totalFound).toBe(2)
    expect(result.imported).toBe(1)
    expect(result.duplicatesSkipped).toBe(1)
  })
})
