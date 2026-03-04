import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./outreach-db', () => {
  const businesses: any[] = []
  return {
    getBusinesses: vi.fn(() => [...businesses]),
    createBusiness: vi.fn((data: any) => {
      const b = { id: String(businesses.length + 1), ...data }
      businesses.push(b)
      return b
    }),
    __resetStore: () => { businesses.length = 0 },
  }
})

import { parseCsvBusinesses, parseTextBusinesses, importBusinesses } from './outreach-import'
import * as mockDb from './outreach-db'

const resetStore = (mockDb as any).__resetStore as () => void

describe('parseCsvBusinesses', () => {
  it('parses comma-separated CSV with standard headers', () => {
    const csv = `Name,Address,Phone,Website,Category
Acme Corp,123 Main St,(555) 111-2222,acme.com,Tech
Beta LLC,456 Oak Ave,(555) 333-4444,beta.io,Finance`

    const result = parseCsvBusinesses(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'Acme Corp',
      address: '123 Main St',
      phone: '(555) 111-2222',
      website: 'acme.com',
      category: 'Tech',
    })
    expect(result[1].name).toBe('Beta LLC')
  })

  it('parses tab-separated values', () => {
    const tsv = `Business Name\tLocation\tTelephone\tURL\tIndustry
Acme Corp\t123 Main St\t555-1234\tacme.com\tTech`

    const result = parseCsvBusinesses(tsv)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'Acme Corp',
      address: '123 Main St',
      phone: '555-1234',
      website: 'acme.com',
      category: 'Tech',
    })
  })

  it('handles quoted fields with commas inside', () => {
    const csv = `Company,Address,Phone,Website,Category
"Smith, Jones & Associates",789 Elm St,(555) 999-0000,sjlaw.com,Legal`

    const result = parseCsvBusinesses(csv)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Smith, Jones & Associates')
  })

  it('handles escaped double quotes inside quoted fields', () => {
    const csv = `Name,Address,Phone,Website,Category
"The ""Best"" Pizza",10 Pine Rd,555-0000,best.com,Food`

    const result = parseCsvBusinesses(csv)
    expect(result[0].name).toBe('The "Best" Pizza')
  })

  it('uses case-insensitive and partial column matching', () => {
    const csv = `BUSINESS NAME,LOCATION,TELEPHONE,SITE,TYPE
Foo,Bar,123,foo.com,Retail`

    const result = parseCsvBusinesses(csv)
    expect(result[0]).toEqual({
      name: 'Foo',
      address: 'Bar',
      phone: '123',
      website: 'foo.com',
      category: 'Retail',
    })
  })

  it('skips rows without a name', () => {
    const csv = `Name,Address
,123 Main St
Valid Biz,456 Oak`

    const result = parseCsvBusinesses(csv)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Valid Biz')
  })

  it('returns empty array for less than 2 lines', () => {
    expect(parseCsvBusinesses('Name,Address')).toEqual([])
    expect(parseCsvBusinesses('')).toEqual([])
  })

  it('returns empty array when no columns match', () => {
    const csv = `Foo,Bar,Baz
1,2,3`
    expect(parseCsvBusinesses(csv)).toEqual([])
  })

  it('fills missing columns with empty string', () => {
    const csv = `Name,Phone
Acme,555-1234`

    const result = parseCsvBusinesses(csv)
    expect(result[0]).toEqual({
      name: 'Acme',
      address: '',
      phone: '555-1234',
      website: '',
      category: '',
    })
  })
})

describe('parseTextBusinesses', () => {
  it('parses a line with name, address, phone, website', () => {
    const text = 'Business Name, 123 Main St, (555) 123-4567, www.example.com'
    const result = parseTextBusinesses(text)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Business Name')
    expect(result[0].phone).toBe('(555) 123-4567')
    expect(result[0].website).toBe('www.example.com')
  })

  it('parses multiple lines', () => {
    const text = `Acme Corp, 100 First Ave, (555) 111-2222, acme.com
Beta LLC, 200 Second Blvd, 555-333-4444`

    const result = parseTextBusinesses(text)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Acme Corp')
    expect(result[1].name).toBe('Beta LLC')
    expect(result[1].website).toBe('')
  })

  it('handles lines with only a name', () => {
    const result = parseTextBusinesses('Just A Name')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Just A Name')
    expect(result[0].address).toBe('')
  })

  it('skips blank lines', () => {
    const text = `Acme Corp, 123 Main St

Beta LLC, 456 Oak Ave`
    const result = parseTextBusinesses(text)
    expect(result).toHaveLength(2)
  })

  it('extracts URLs with https prefix', () => {
    const text = 'My Biz, 1 St, https://mybiz.com'
    const result = parseTextBusinesses(text)
    expect(result[0].website).toBe('https://mybiz.com')
  })
})

describe('importBusinesses', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('imports new businesses', () => {
    const businesses = [
      { name: 'Acme', address: '123 Main', phone: '', website: '', category: '' },
      { name: 'Beta', address: '456 Oak', phone: '', website: '', category: '' },
    ]

    const result = importBusinesses(businesses)
    expect(result.imported).toBe(2)
    expect(result.duplicatesSkipped).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('skips duplicates within the same batch', () => {
    const businesses = [
      { name: 'Acme', address: '123 Main', phone: '', website: '', category: '' },
      { name: 'Acme', address: '123 Main', phone: '555', website: '', category: '' },
    ]

    const result = importBusinesses(businesses)
    expect(result.imported).toBe(1)
    expect(result.duplicatesSkipped).toBe(1)
  })

  it('passes source=manual and status=New to createBusiness', () => {
    importBusinesses([
      { name: 'Test', address: '', phone: '555', website: 'test.com', category: 'Tech' },
    ])

    expect(mockDb.createBusiness).toHaveBeenCalledWith({
      name: 'Test',
      address: '',
      phone: '555',
      website: 'test.com',
      category: 'Tech',
      source: 'manual',
      status: 'New',
    })
  })

  it('reports errors for failed inserts', () => {
    vi.mocked(mockDb.createBusiness).mockImplementationOnce(() => {
      throw new Error('DB error')
    })

    const result = importBusinesses([
      { name: 'Bad Biz', address: '', phone: '', website: '', category: '' },
    ])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Bad Biz')
    expect(result.imported).toBe(0)
  })
})
