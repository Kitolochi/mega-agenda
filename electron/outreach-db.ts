import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import Database from 'better-sqlite3'
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

// ── Database singleton ──

let db: Database.Database

export function initOutreachTables(): void {
  const dbPath = path.join(app.getPath('userData'), 'outreach.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      lat REAL,
      lng REAL,
      rating REAL,
      reviewCount INTEGER,
      socialLinks TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'New',
      notes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      businessId TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      linkedinUrl TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outreach (
      id TEXT PRIMARY KEY,
      businessId TEXT NOT NULL,
      contactId TEXT,
      channel TEXT NOT NULL,
      messageText TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      sentAt TEXT,
      respondedAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      variables TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL
    );
  `)
}

// ── Helpers ──

function now(): string {
  return new Date().toISOString()
}

function parseSocialLinks(raw: string): Record<string, string> {
  try { return JSON.parse(raw) } catch { return {} }
}

function parseVariables(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function rowToBusiness(row: any): Business {
  return {
    ...row,
    socialLinks: parseSocialLinks(row.socialLinks),
  }
}

function rowToTemplate(row: any): Template {
  return {
    ...row,
    variables: parseVariables(row.variables),
  }
}

// ── Businesses CRUD ──

export function createBusiness(data: Partial<Business> & { name: string }): Business {
  const id = crypto.randomUUID()
  const ts = now()
  const stmt = db.prepare(`
    INSERT INTO businesses (id, name, address, phone, website, category, source, lat, lng, rating, reviewCount, socialLinks, status, notes, createdAt, updatedAt)
    VALUES (@id, @name, @address, @phone, @website, @category, @source, @lat, @lng, @rating, @reviewCount, @socialLinks, @status, @notes, @createdAt, @updatedAt)
  `)
  stmt.run({
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
    socialLinks: JSON.stringify(data.socialLinks ?? {}),
    status: data.status ?? 'New',
    notes: data.notes ?? '',
    createdAt: ts,
    updatedAt: ts,
  })
  return getBusiness(id)!
}

export function getBusinesses(filters?: {
  status?: BusinessStatus
  category?: string
  source?: string
  search?: string
}): Business[] {
  let sql = 'SELECT * FROM businesses WHERE 1=1'
  const params: any = {}

  if (filters?.status) {
    sql += ' AND status = @status'
    params.status = filters.status
  }
  if (filters?.category) {
    sql += ' AND category = @category'
    params.category = filters.category
  }
  if (filters?.source) {
    sql += ' AND source = @source'
    params.source = filters.source
  }
  if (filters?.search) {
    sql += ' AND (name LIKE @search OR address LIKE @search OR notes LIKE @search)'
    params.search = `%${filters.search}%`
  }

  sql += ' ORDER BY updatedAt DESC'

  return db.prepare(sql).all(params).map(rowToBusiness)
}

export function getBusiness(id: string): Business | null {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id)
  return row ? rowToBusiness(row) : null
}

export function updateBusiness(id: string, updates: Partial<Business>): Business | null {
  const existing = getBusiness(id)
  if (!existing) return null

  const fields: string[] = []
  const params: any = { id }

  if (updates.name !== undefined) { fields.push('name = @name'); params.name = updates.name }
  if (updates.address !== undefined) { fields.push('address = @address'); params.address = updates.address }
  if (updates.phone !== undefined) { fields.push('phone = @phone'); params.phone = updates.phone }
  if (updates.website !== undefined) { fields.push('website = @website'); params.website = updates.website }
  if (updates.category !== undefined) { fields.push('category = @category'); params.category = updates.category }
  if (updates.source !== undefined) { fields.push('source = @source'); params.source = updates.source }
  if (updates.lat !== undefined) { fields.push('lat = @lat'); params.lat = updates.lat }
  if (updates.lng !== undefined) { fields.push('lng = @lng'); params.lng = updates.lng }
  if (updates.rating !== undefined) { fields.push('rating = @rating'); params.rating = updates.rating }
  if (updates.reviewCount !== undefined) { fields.push('reviewCount = @reviewCount'); params.reviewCount = updates.reviewCount }
  if (updates.socialLinks !== undefined) { fields.push('socialLinks = @socialLinks'); params.socialLinks = JSON.stringify(updates.socialLinks) }
  if (updates.status !== undefined) { fields.push('status = @status'); params.status = updates.status }
  if (updates.notes !== undefined) { fields.push('notes = @notes'); params.notes = updates.notes }

  if (fields.length === 0) return existing

  fields.push('updatedAt = @updatedAt')
  params.updatedAt = now()

  db.prepare(`UPDATE businesses SET ${fields.join(', ')} WHERE id = @id`).run(params)
  return getBusiness(id)
}

export function deleteBusiness(id: string): void {
  db.prepare('DELETE FROM businesses WHERE id = ?').run(id)
}

// ── Contacts CRUD ──

export function createContact(data: Partial<Contact> & { businessId: string; name: string }): Contact {
  const id = crypto.randomUUID()
  const ts = now()
  db.prepare(`
    INSERT INTO contacts (id, businessId, name, title, email, linkedinUrl, source, createdAt)
    VALUES (@id, @businessId, @name, @title, @email, @linkedinUrl, @source, @createdAt)
  `).run({
    id,
    businessId: data.businessId,
    name: data.name,
    title: data.title ?? '',
    email: data.email ?? '',
    linkedinUrl: data.linkedinUrl ?? '',
    source: data.source ?? '',
    createdAt: ts,
  })
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact
}

export function getBusinessContacts(businessId: string): Contact[] {
  return db.prepare('SELECT * FROM contacts WHERE businessId = ? ORDER BY createdAt DESC').all(businessId) as Contact[]
}

export function deleteContact(id: string): void {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id)
}

// ── Outreach CRUD ──

export function createOutreach(data: Partial<Outreach> & { businessId: string; channel: OutreachChannel }): Outreach {
  const id = crypto.randomUUID()
  const ts = now()
  db.prepare(`
    INSERT INTO outreach (id, businessId, contactId, channel, messageText, status, sentAt, respondedAt, createdAt)
    VALUES (@id, @businessId, @contactId, @channel, @messageText, @status, @sentAt, @respondedAt, @createdAt)
  `).run({
    id,
    businessId: data.businessId,
    contactId: data.contactId ?? null,
    channel: data.channel,
    messageText: data.messageText ?? '',
    status: data.status ?? 'draft',
    sentAt: data.sentAt ?? null,
    respondedAt: data.respondedAt ?? null,
    createdAt: ts,
  })
  return db.prepare('SELECT * FROM outreach WHERE id = ?').get(id) as Outreach
}

export function getBusinessOutreach(businessId: string): Outreach[] {
  return db.prepare('SELECT * FROM outreach WHERE businessId = ? ORDER BY createdAt DESC').all(businessId) as Outreach[]
}

export function updateOutreach(id: string, updates: Partial<Outreach>): Outreach | null {
  const existing = db.prepare('SELECT * FROM outreach WHERE id = ?').get(id) as Outreach | undefined
  if (!existing) return null

  const fields: string[] = []
  const params: any = { id }

  if (updates.contactId !== undefined) { fields.push('contactId = @contactId'); params.contactId = updates.contactId }
  if (updates.channel !== undefined) { fields.push('channel = @channel'); params.channel = updates.channel }
  if (updates.messageText !== undefined) { fields.push('messageText = @messageText'); params.messageText = updates.messageText }
  if (updates.status !== undefined) { fields.push('status = @status'); params.status = updates.status }
  if (updates.sentAt !== undefined) { fields.push('sentAt = @sentAt'); params.sentAt = updates.sentAt }
  if (updates.respondedAt !== undefined) { fields.push('respondedAt = @respondedAt'); params.respondedAt = updates.respondedAt }

  if (fields.length === 0) return existing

  db.prepare(`UPDATE outreach SET ${fields.join(', ')} WHERE id = @id`).run(params)
  return db.prepare('SELECT * FROM outreach WHERE id = ?').get(id) as Outreach
}

// ── Templates CRUD ──

export function createTemplate(data: Partial<Template> & { name: string; channel: OutreachChannel }): Template {
  const id = crypto.randomUUID()
  const ts = now()
  db.prepare(`
    INSERT INTO templates (id, name, channel, subject, body, variables, createdAt)
    VALUES (@id, @name, @channel, @subject, @body, @variables, @createdAt)
  `).run({
    id,
    name: data.name,
    channel: data.channel,
    subject: data.subject ?? '',
    body: data.body ?? '',
    variables: JSON.stringify(data.variables ?? []),
    createdAt: ts,
  })
  return rowToTemplate(db.prepare('SELECT * FROM templates WHERE id = ?').get(id))
}

export function getTemplates(): Template[] {
  return db.prepare('SELECT * FROM templates ORDER BY createdAt DESC').all().map(rowToTemplate)
}

export function getTemplate(id: string): Template | null {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id)
  return row ? rowToTemplate(row) : null
}

export function updateTemplate(id: string, updates: Partial<Template>): Template | null {
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id)
  if (!existing) return null

  const fields: string[] = []
  const params: any = { id }

  if (updates.name !== undefined) { fields.push('name = @name'); params.name = updates.name }
  if (updates.channel !== undefined) { fields.push('channel = @channel'); params.channel = updates.channel }
  if (updates.subject !== undefined) { fields.push('subject = @subject'); params.subject = updates.subject }
  if (updates.body !== undefined) { fields.push('body = @body'); params.body = updates.body }
  if (updates.variables !== undefined) { fields.push('variables = @variables'); params.variables = JSON.stringify(updates.variables) }

  if (fields.length === 0) return rowToTemplate(existing)

  db.prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = @id`).run(params)
  return getTemplate(id)
}

export function deleteTemplate(id: string): void {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id)
}

export function seedDefaultTemplates(): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM templates').get() as { cnt: number }
  if (count.cnt > 0) return

  const insert = db.prepare(`
    INSERT INTO templates (id, name, channel, subject, body, variables, createdAt)
    VALUES (@id, @name, @channel, @subject, @body, @variables, @createdAt)
  `)

  const ts = now()
  const seedAll = db.transaction(() => {
    for (const t of DEFAULT_TEMPLATES) {
      insert.run({
        id: crypto.randomUUID(),
        name: t.name,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        variables: JSON.stringify(t.variables),
        createdAt: ts,
      })
    }
  })
  seedAll()
}

// ── Stats ──

export function getPipelineStats(): PipelineStats[] {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM businesses
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'New' THEN 1
        WHEN 'Contacted' THEN 2
        WHEN 'Responded' THEN 3
        WHEN 'Not Interested' THEN 4
        WHEN 'Meeting Scheduled' THEN 5
        ELSE 6
      END
  `).all() as PipelineStats[]

  return rows
}
