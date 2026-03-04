import { createBusiness, getBusinesses, type Business } from './outreach-db'

// ── Types ──

export interface ParsedBusiness {
  name: string
  address: string
  phone: string
  website: string
  category: string
}

export interface ImportResult {
  imported: number
  duplicatesSkipped: number
  errors: string[]
}

// ── Column matching ──

const COLUMN_PATTERNS: Record<keyof ParsedBusiness, RegExp> = {
  name: /name|business|company/i,
  address: /address|location/i,
  phone: /phone|telephone/i,
  website: /website|url|site/i,
  category: /category|type|industry/i,
}

function matchColumn(header: string): keyof ParsedBusiness | null {
  const trimmed = header.trim()
  for (const [field, pattern] of Object.entries(COLUMN_PATTERNS)) {
    if (pattern.test(trimmed)) return field as keyof ParsedBusiness
  }
  return null
}

// ── CSV field parsing (handles quoted fields) ──

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }

  fields.push(current.trim())
  return fields
}

// ── Delimiter detection ──

function detectDelimiter(firstLine: string): string {
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  return tabCount > commaCount ? '\t' : ','
}

// ── CSV parsing ──

export function parseCsvBusinesses(csvText: string): ParsedBusiness[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter)

  const columnMap = new Map<number, keyof ParsedBusiness>()
  for (let i = 0; i < headers.length; i++) {
    const field = matchColumn(headers[i])
    if (field) columnMap.set(i, field)
  }

  if (columnMap.size === 0) return []

  const results: ParsedBusiness[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i], delimiter)
    const biz: ParsedBusiness = { name: '', address: '', phone: '', website: '', category: '' }

    for (const [colIdx, fieldName] of columnMap) {
      if (colIdx < fields.length) {
        biz[fieldName] = fields[colIdx]
      }
    }

    if (biz.name) results.push(biz)
  }

  return results
}

// ── Free-form text parsing ──

const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/\S*)?/

export function parseTextBusinesses(text: string): ParsedBusiness[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  const results: ParsedBusiness[] = []

  for (const line of lines) {
    const biz: ParsedBusiness = { name: '', address: '', phone: '', website: '', category: '' }

    const phoneMatch = line.match(PHONE_RE)
    if (phoneMatch) biz.phone = phoneMatch[0].trim()

    const urlMatch = line.match(URL_RE)
    if (urlMatch) biz.website = urlMatch[0].trim()

    let remaining = line
    if (biz.phone) remaining = remaining.replace(biz.phone, '')
    if (biz.website) remaining = remaining.replace(biz.website, '')

    const parts = remaining.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length > 0) biz.name = parts[0]
    if (parts.length > 1) biz.address = parts.slice(1).join(', ')

    if (biz.name) results.push(biz)
  }

  return results
}

// ── Import to database ──

export function importBusinesses(businesses: ParsedBusiness[]): ImportResult {
  const result: ImportResult = { imported: 0, duplicatesSkipped: 0, errors: [] }

  const existing = getBusinesses()
  const existingKeys = new Set(
    existing.map(b => `${b.name.toLowerCase()}|${b.address.toLowerCase()}`)
  )

  for (const biz of businesses) {
    const key = `${biz.name.toLowerCase()}|${biz.address.toLowerCase()}`
    if (existingKeys.has(key)) {
      result.duplicatesSkipped++
      continue
    }

    try {
      createBusiness({
        name: biz.name,
        address: biz.address,
        phone: biz.phone,
        website: biz.website,
        category: biz.category,
        source: 'manual',
        status: 'New',
      })
      existingKeys.add(key)
      result.imported++
    } catch (err: any) {
      result.errors.push(`Failed to import "${biz.name}": ${err.message}`)
    }
  }

  return result
}
