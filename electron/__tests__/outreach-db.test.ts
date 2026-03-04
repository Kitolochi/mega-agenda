// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTempDir, cleanupTempDir } from './helpers/temp-dir'

// ── Electron mock ────────────────────────────────────────────────────
const mockElectronState = vi.hoisted(() => ({ userDataDir: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((_name: string) => mockElectronState.userDataDir),
  },
}))

import {
  initOutreachTables,
  createBusiness,
  getBusinesses,
  getBusiness,
  updateBusiness,
  deleteBusiness,
  createContact,
  getBusinessContacts,
  deleteContact,
  createOutreach,
  getBusinessOutreach,
  updateOutreach,
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  seedDefaultTemplates,
  getPipelineStats,
} from '../outreach-db'

let tempDir: string

beforeEach(() => {
  tempDir = createTempDir()
  mockElectronState.userDataDir = tempDir
  initOutreachTables()
})

afterEach(() => {
  cleanupTempDir(tempDir)
})

// ── Businesses ────────────────────────────────────────────────────────

describe('businesses', () => {
  it('creates and retrieves a business', () => {
    const b = createBusiness({ name: 'Acme Corp', category: 'Tech', source: 'Google Maps' })
    expect(b.id).toBeTruthy()
    expect(b.name).toBe('Acme Corp')
    expect(b.status).toBe('New')
    expect(b.socialLinks).toEqual({})

    const fetched = getBusiness(b.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('Acme Corp')
  })

  it('lists all businesses', () => {
    createBusiness({ name: 'Biz A' })
    createBusiness({ name: 'Biz B' })
    const all = getBusinesses()
    expect(all.length).toBe(2)
  })

  it('filters by status', () => {
    createBusiness({ name: 'New Biz', status: 'New' })
    createBusiness({ name: 'Contacted Biz', status: 'Contacted' })
    const filtered = getBusinesses({ status: 'Contacted' })
    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('Contacted Biz')
  })

  it('filters by category', () => {
    createBusiness({ name: 'Tech Co', category: 'Tech' })
    createBusiness({ name: 'Food Co', category: 'Food' })
    const filtered = getBusinesses({ category: 'Tech' })
    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('Tech Co')
  })

  it('filters by source', () => {
    createBusiness({ name: 'Maps Biz', source: 'Google Maps' })
    createBusiness({ name: 'Manual Biz', source: 'Manual' })
    const filtered = getBusinesses({ source: 'Google Maps' })
    expect(filtered.length).toBe(1)
  })

  it('searches by name, address, or notes', () => {
    createBusiness({ name: 'Acme Corp', address: '123 Main St', notes: 'Good lead' })
    createBusiness({ name: 'Other Inc', address: '456 Oak Ave', notes: 'Not interested' })
    expect(getBusinesses({ search: 'Acme' }).length).toBe(1)
    expect(getBusinesses({ search: 'Main' }).length).toBe(1)
    expect(getBusinesses({ search: 'lead' }).length).toBe(1)
  })

  it('updates a business', () => {
    const b = createBusiness({ name: 'Original' })
    const updated = updateBusiness(b.id, { name: 'Updated', status: 'Contacted', rating: 4.5 })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Updated')
    expect(updated!.status).toBe('Contacted')
    expect(updated!.rating).toBe(4.5)
  })

  it('returns null when updating non-existent business', () => {
    const result = updateBusiness('non-existent', { name: 'Nope' })
    expect(result).toBeNull()
  })

  it('deletes a business', () => {
    const b = createBusiness({ name: 'To Delete' })
    deleteBusiness(b.id)
    expect(getBusiness(b.id)).toBeNull()
  })

  it('cascades delete to contacts and outreach', () => {
    const b = createBusiness({ name: 'Cascade Test' })
    const c = createContact({ businessId: b.id, name: 'John' })
    createOutreach({ businessId: b.id, contactId: c.id, channel: 'email' })

    deleteBusiness(b.id)

    expect(getBusinessContacts(b.id).length).toBe(0)
    expect(getBusinessOutreach(b.id).length).toBe(0)
  })

  it('stores socialLinks as JSON', () => {
    const links = { linkedin: 'https://linkedin.com/acme', twitter: '@acme' }
    const b = createBusiness({ name: 'Social Biz', socialLinks: links })
    const fetched = getBusiness(b.id)!
    expect(fetched.socialLinks).toEqual(links)
  })

  it('stores numeric fields correctly', () => {
    const b = createBusiness({
      name: 'Numeric Biz',
      lat: 40.7128,
      lng: -74.006,
      rating: 4.2,
      reviewCount: 150,
    })
    const fetched = getBusiness(b.id)!
    expect(fetched.lat).toBeCloseTo(40.7128)
    expect(fetched.lng).toBeCloseTo(-74.006)
    expect(fetched.rating).toBeCloseTo(4.2)
    expect(fetched.reviewCount).toBe(150)
  })
})

// ── Contacts ──────────────────────────────────────────────────────────

describe('contacts', () => {
  it('creates a contact linked to a business', () => {
    const b = createBusiness({ name: 'Biz' })
    const c = createContact({ businessId: b.id, name: 'Jane Doe', email: 'jane@example.com' })
    expect(c.id).toBeTruthy()
    expect(c.businessId).toBe(b.id)
    expect(c.name).toBe('Jane Doe')
  })

  it('lists contacts for a specific business', () => {
    const b1 = createBusiness({ name: 'Biz1' })
    const b2 = createBusiness({ name: 'Biz2' })
    createContact({ businessId: b1.id, name: 'Alice' })
    createContact({ businessId: b1.id, name: 'Bob' })
    createContact({ businessId: b2.id, name: 'Charlie' })

    expect(getBusinessContacts(b1.id).length).toBe(2)
    expect(getBusinessContacts(b2.id).length).toBe(1)
  })

  it('deletes a contact', () => {
    const b = createBusiness({ name: 'Biz' })
    const c = createContact({ businessId: b.id, name: 'Temp' })
    deleteContact(c.id)
    expect(getBusinessContacts(b.id).length).toBe(0)
  })
})

// ── Outreach ──────────────────────────────────────────────────────────

describe('outreach', () => {
  it('creates an outreach record', () => {
    const b = createBusiness({ name: 'Biz' })
    const o = createOutreach({
      businessId: b.id,
      channel: 'email',
      messageText: 'Hello!',
      status: 'sent',
    })
    expect(o.id).toBeTruthy()
    expect(o.businessId).toBe(b.id)
    expect(o.channel).toBe('email')
    expect(o.contactId).toBeNull()
  })

  it('links outreach to a contact', () => {
    const b = createBusiness({ name: 'Biz' })
    const c = createContact({ businessId: b.id, name: 'Contact' })
    const o = createOutreach({ businessId: b.id, contactId: c.id, channel: 'linkedin' })
    expect(o.contactId).toBe(c.id)
  })

  it('lists outreach for a business', () => {
    const b = createBusiness({ name: 'Biz' })
    createOutreach({ businessId: b.id, channel: 'email' })
    createOutreach({ businessId: b.id, channel: 'linkedin' })
    expect(getBusinessOutreach(b.id).length).toBe(2)
  })

  it('updates outreach fields', () => {
    const b = createBusiness({ name: 'Biz' })
    const o = createOutreach({ businessId: b.id, channel: 'email' })
    const ts = new Date().toISOString()
    const updated = updateOutreach(o.id, { status: 'replied', respondedAt: ts })
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('replied')
    expect(updated!.respondedAt).toBe(ts)
  })

  it('returns null when updating non-existent outreach', () => {
    expect(updateOutreach('nope', { status: 'sent' })).toBeNull()
  })
})

// ── Templates ─────────────────────────────────────────────────────────

describe('templates', () => {
  it('creates and retrieves a template', () => {
    const t = createTemplate({
      name: 'Test Template',
      channel: 'email',
      subject: 'Hello {{name}}',
      body: 'Dear {{name}}, ...',
      variables: ['name'],
    })
    expect(t.id).toBeTruthy()
    expect(t.variables).toEqual(['name'])

    const fetched = getTemplate(t.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.name).toBe('Test Template')
    expect(fetched!.variables).toEqual(['name'])
  })

  it('lists all templates', () => {
    createTemplate({ name: 'T1', channel: 'email' })
    createTemplate({ name: 'T2', channel: 'linkedin' })
    expect(getTemplates().length).toBe(2)
  })

  it('updates a template', () => {
    const t = createTemplate({ name: 'Original', channel: 'email' })
    const updated = updateTemplate(t.id, { name: 'Updated', body: 'New body', variables: ['a', 'b'] })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Updated')
    expect(updated!.body).toBe('New body')
    expect(updated!.variables).toEqual(['a', 'b'])
  })

  it('returns null when updating non-existent template', () => {
    expect(updateTemplate('nope', { name: 'X' })).toBeNull()
  })

  it('deletes a template', () => {
    const t = createTemplate({ name: 'To Delete', channel: 'email' })
    deleteTemplate(t.id)
    expect(getTemplate(t.id)).toBeNull()
  })

  it('seeds default templates only once', () => {
    seedDefaultTemplates()
    const first = getTemplates().length
    expect(first).toBeGreaterThan(0)

    seedDefaultTemplates() // second call should be a no-op
    expect(getTemplates().length).toBe(first)
  })
})

// ── Pipeline Stats ────────────────────────────────────────────────────

describe('getPipelineStats', () => {
  it('returns counts grouped by status', () => {
    createBusiness({ name: 'A', status: 'New' })
    createBusiness({ name: 'B', status: 'New' })
    createBusiness({ name: 'C', status: 'Contacted' })
    createBusiness({ name: 'D', status: 'Meeting Scheduled' })

    const stats = getPipelineStats()
    const newStat = stats.find(s => s.status === 'New')
    const contactedStat = stats.find(s => s.status === 'Contacted')
    const meetingStat = stats.find(s => s.status === 'Meeting Scheduled')

    expect(newStat?.count).toBe(2)
    expect(contactedStat?.count).toBe(1)
    expect(meetingStat?.count).toBe(1)
  })

  it('returns empty array when no businesses', () => {
    const stats = getPipelineStats()
    expect(stats).toEqual([])
  })
})
