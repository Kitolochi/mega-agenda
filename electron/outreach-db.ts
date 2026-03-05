import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { app } from 'electron'
import { DEFAULT_TEMPLATES } from './outreach-templates'

// ── Types ──

export type BusinessStatus = 'New' | 'Contacted' | 'Responded' | 'Not Interested' | 'Meeting Scheduled'
export type OutreachChannel = 'email' | 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'website'

export interface Business {
  id: string
  name: string
  address: string
  phone: string
  website: string
  category: string
  source: string
  lat: number | null
  lng: number | null
  rating: number | null
  reviewCount: number | null
  socialLinks: Record<string, string>
  status: BusinessStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  businessId: string
  name: string
  title: string
  email: string
  linkedinUrl: string
  source: string
  createdAt: string
}

export interface Outreach {
  id: string
  businessId: string
  contactId: string | null
  channel: OutreachChannel
  messageText: string
  status: string
  sentAt: string | null
  respondedAt: string | null
  createdAt: string
}

export interface Template {
  id: string
  name: string
  channel: OutreachChannel
  subject: string
  body: string
  variables: string[]
  createdAt: string
}

export interface PipelineStats {
  status: BusinessStatus
  count: number
}

// ── Settings ──

export interface OutreachSettings {
  google_places_api_key: string
  apollo_api_key: string
  default_lat: string
  default_lng: string
  default_radius: string
  resume_link: string
  onboarding_completed: string
}

const SETTINGS_DEFAULTS: OutreachSettings = {
  google_places_api_key: '',
  apollo_api_key: '',
  default_lat: '35.2271',
  default_lng: '-80.8431',
  default_radius: '25000',
  resume_link: '',
  onboarding_completed: 'false',
}

// ── JSON Database ──

interface OutreachDatabase {
  businesses: Business[]
  contacts: Contact[]
  outreach: Outreach[]
  templates: Template[]
  settings: Record<string, string>
}

let db: OutreachDatabase
let dbPath: string

function saveDatabase(): void {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8')
}

function now(): string {
  return new Date().toISOString()
}

export function initOutreachTables(): void {
  dbPath = path.join(app.getPath('userData'), 'outreach.json')

  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, 'utf-8')
    db = JSON.parse(data)
    // Ensure all collections exist (migration safety)
    if (!db.businesses) db.businesses = []
    if (!db.contacts) db.contacts = []
    if (!db.outreach) db.outreach = []
    if (!db.templates) db.templates = []
    if (!db.settings) db.settings = {}
    saveDatabase()
  } else {
    db = {
      businesses: [],
      contacts: [],
      outreach: [],
      templates: [],
      settings: {},
    }
    saveDatabase()
  }
}

// ── Businesses CRUD ──

export function createBusiness(data: Partial<Business> & { name: string }): Business {
  const id = crypto.randomUUID()
  const ts = now()
  const business: Business = {
    id,
    name: data.name,
    address: data.address ?? '',
    phone: data.phone ?? '',
    website: data.website ?? '',
    category: data.category ?? '',
    source: data.source ?? '',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    rating: data.rating ?? null,
    reviewCount: data.reviewCount ?? null,
    socialLinks: data.socialLinks ?? {},
    status: data.status ?? 'New',
    notes: data.notes ?? '',
    createdAt: ts,
    updatedAt: ts,
  }
  db.businesses.push(business)
  saveDatabase()
  return business
}

export function getBusinesses(filters?: {
  status?: BusinessStatus
  category?: string
  source?: string
  search?: string
}): Business[] {
  let results = db.businesses

  if (filters?.status) {
    results = results.filter(b => b.status === filters.status)
  }
  if (filters?.category) {
    results = results.filter(b => b.category === filters.category)
  }
  if (filters?.source) {
    results = results.filter(b => b.source === filters.source)
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase()
    results = results.filter(b =>
      b.name.toLowerCase().includes(term) ||
      b.address.toLowerCase().includes(term) ||
      b.notes.toLowerCase().includes(term)
    )
  }

  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getBusiness(id: string): Business | null {
  return db.businesses.find(b => b.id === id) ?? null
}

export function updateBusiness(id: string, updates: Partial<Business>): Business | null {
  const biz = db.businesses.find(b => b.id === id)
  if (!biz) return null

  if (updates.name !== undefined) biz.name = updates.name
  if (updates.address !== undefined) biz.address = updates.address
  if (updates.phone !== undefined) biz.phone = updates.phone
  if (updates.website !== undefined) biz.website = updates.website
  if (updates.category !== undefined) biz.category = updates.category
  if (updates.source !== undefined) biz.source = updates.source
  if (updates.lat !== undefined) biz.lat = updates.lat
  if (updates.lng !== undefined) biz.lng = updates.lng
  if (updates.rating !== undefined) biz.rating = updates.rating
  if (updates.reviewCount !== undefined) biz.reviewCount = updates.reviewCount
  if (updates.socialLinks !== undefined) biz.socialLinks = updates.socialLinks
  if (updates.status !== undefined) biz.status = updates.status
  if (updates.notes !== undefined) biz.notes = updates.notes
  biz.updatedAt = now()

  saveDatabase()
  return biz
}

export function deleteBusiness(id: string): void {
  db.businesses = db.businesses.filter(b => b.id !== id)
  // Cascade: remove contacts and outreach for this business
  db.contacts = db.contacts.filter(c => c.businessId !== id)
  db.outreach = db.outreach.filter(o => o.businessId !== id)
  saveDatabase()
}

// ── Contacts CRUD ──

export function createContact(data: Partial<Contact> & { businessId: string; name: string }): Contact {
  const contact: Contact = {
    id: crypto.randomUUID(),
    businessId: data.businessId,
    name: data.name,
    title: data.title ?? '',
    email: data.email ?? '',
    linkedinUrl: data.linkedinUrl ?? '',
    source: data.source ?? '',
    createdAt: now(),
  }
  db.contacts.push(contact)
  saveDatabase()
  return contact
}

export function getBusinessContacts(businessId: string): Contact[] {
  return db.contacts
    .filter(c => c.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function deleteContact(id: string): void {
  db.contacts = db.contacts.filter(c => c.id !== id)
  // Nullify contactId references in outreach
  db.outreach.forEach(o => {
    if (o.contactId === id) o.contactId = null
  })
  saveDatabase()
}

// ── Outreach CRUD ──

export function createOutreach(data: Partial<Outreach> & { businessId: string; channel: OutreachChannel }): Outreach {
  const outreach: Outreach = {
    id: crypto.randomUUID(),
    businessId: data.businessId,
    contactId: data.contactId ?? null,
    channel: data.channel,
    messageText: data.messageText ?? '',
    status: data.status ?? 'draft',
    sentAt: data.sentAt ?? null,
    respondedAt: data.respondedAt ?? null,
    createdAt: now(),
  }
  db.outreach.push(outreach)
  saveDatabase()
  return outreach
}

export function getBusinessOutreach(businessId: string): Outreach[] {
  return db.outreach
    .filter(o => o.businessId === businessId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function updateOutreach(id: string, updates: Partial<Outreach>): Outreach | null {
  const o = db.outreach.find(x => x.id === id)
  if (!o) return null

  if (updates.contactId !== undefined) o.contactId = updates.contactId
  if (updates.channel !== undefined) o.channel = updates.channel
  if (updates.messageText !== undefined) o.messageText = updates.messageText
  if (updates.status !== undefined) o.status = updates.status
  if (updates.sentAt !== undefined) o.sentAt = updates.sentAt
  if (updates.respondedAt !== undefined) o.respondedAt = updates.respondedAt

  saveDatabase()
  return o
}

// ── Templates CRUD ──

export function createTemplate(data: Partial<Template> & { name: string; channel: OutreachChannel }): Template {
  const template: Template = {
    id: crypto.randomUUID(),
    name: data.name,
    channel: data.channel,
    subject: data.subject ?? '',
    body: data.body ?? '',
    variables: data.variables ?? [],
    createdAt: now(),
  }
  db.templates.push(template)
  saveDatabase()
  return template
}

export function getTemplates(): Template[] {
  return [...db.templates].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getTemplate(id: string): Template | null {
  return db.templates.find(t => t.id === id) ?? null
}

export function updateTemplate(id: string, updates: Partial<Template>): Template | null {
  const t = db.templates.find(x => x.id === id)
  if (!t) return null

  if (updates.name !== undefined) t.name = updates.name
  if (updates.channel !== undefined) t.channel = updates.channel
  if (updates.subject !== undefined) t.subject = updates.subject
  if (updates.body !== undefined) t.body = updates.body
  if (updates.variables !== undefined) t.variables = updates.variables

  saveDatabase()
  return t
}

export function deleteTemplate(id: string): void {
  db.templates = db.templates.filter(t => t.id !== id)
  saveDatabase()
}

export function seedDefaultTemplates(): void {
  if (db.templates.length > 0) return

  const ts = now()
  for (const t of DEFAULT_TEMPLATES) {
    db.templates.push({
      id: crypto.randomUUID(),
      name: t.name,
      channel: t.channel,
      subject: t.subject,
      body: t.body,
      variables: t.variables,
      createdAt: ts,
    })
  }
  saveDatabase()
}

// ── Settings (key-value) ──

export function getOutreachSetting(key: keyof OutreachSettings): string {
  return db.settings[key] ?? SETTINGS_DEFAULTS[key] ?? ''
}

export function getAllOutreachSettings(): OutreachSettings {
  const result = { ...SETTINGS_DEFAULTS }
  for (const [key, value] of Object.entries(db.settings)) {
    if (key in result) {
      (result as any)[key] = value
    }
  }
  return result
}

export function setOutreachSetting(key: keyof OutreachSettings, value: string): void {
  db.settings[key] = value
  saveDatabase()
}

export function getBusinessCount(): number {
  return db.businesses.length
}

// ── Stats ──

export function getPipelineStats(): PipelineStats[] {
  const statusOrder: BusinessStatus[] = ['New', 'Contacted', 'Responded', 'Not Interested', 'Meeting Scheduled']
  const counts = new Map<BusinessStatus, number>()

  for (const b of db.businesses) {
    counts.set(b.status, (counts.get(b.status) || 0) + 1)
  }

  return statusOrder
    .filter(s => counts.has(s))
    .map(s => ({ status: s, count: counts.get(s)! }))
}
