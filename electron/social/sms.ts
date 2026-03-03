import fs from 'fs'
import path from 'path'
import type { SocialProviderInterface, SyncResult, ExternalContact, ExternalInteraction } from './types'

/**
 * SMS Provider — reads Phone Link SQLite DB via sql.js (WASM, no native deps).
 * Read-only import of phone contacts and SMS threads.
 */
export class SMSProvider implements SocialProviderInterface {
  private dbPath: string

  constructor(credentials: { dbPath: string }) {
    this.dbPath = credentials.dbPath
  }

  async connect(credentials: { dbPath: string }): Promise<{ accountId: string; accountName: string }> {
    const dbPath = credentials.dbPath
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Phone Link database not found at: ${dbPath}`)
    }
    return {
      accountId: 'phone-link',
      accountName: 'Phone Link SMS',
    }
  }

  async disconnect(): Promise<void> {
    // No-op — file-based, no session to tear down
  }

  async sync(): Promise<SyncResult> {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Phone Link database not found at: ${this.dbPath}`)
    }

    // Dynamic import sql.js
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs()

    const buffer = fs.readFileSync(this.dbPath)
    const db = new SQL.Database(buffer)

    const contacts: ExternalContact[] = []
    const interactions: ExternalInteraction[] = []
    const seenAddresses = new Set<string>()

    try {
      // Query messages — Phone Link DB structure varies, try common table names
      let rows: any[] = []
      try {
        const result = db.exec(
          `SELECT address, body, date, type FROM message ORDER BY date DESC LIMIT 500`
        )
        if (result.length > 0) {
          rows = result[0].values.map(([address, body, date, type]: any[]) => ({
            address: String(address || ''),
            body: String(body || ''),
            date: date ? new Date(Number(date)).toISOString() : new Date().toISOString(),
            type: Number(type || 0),
          }))
        }
      } catch {
        // Try alternative table name
        try {
          const result = db.exec(
            `SELECT sender, body, timestamp, type FROM messages ORDER BY timestamp DESC LIMIT 500`
          )
          if (result.length > 0) {
            rows = result[0].values.map(([sender, body, timestamp, type]: any[]) => ({
              address: String(sender || ''),
              body: String(body || ''),
              date: timestamp ? new Date(Number(timestamp)).toISOString() : new Date().toISOString(),
              type: Number(type || 0),
            }))
          }
        } catch {
          console.warn('[sms] Could not find messages table in Phone Link DB')
        }
      }

      // Extract unique contacts from message addresses
      for (const row of rows) {
        const address = row.address.trim()
        if (!address || seenAddresses.has(address)) continue
        seenAddresses.add(address)

        contacts.push({
          externalId: `sms-${address}`,
          name: address, // Phone number as name — contact matching will resolve
          phone: address,
        })
      }

      // Convert messages to interactions
      for (const row of rows) {
        const address = row.address.trim()
        if (!address) continue

        const direction = row.type === 1 ? 'Received' : 'Sent'
        const preview = row.body.length > 80 ? row.body.slice(0, 80) + '...' : row.body

        interactions.push({
          externalId: `sms-${address}-${row.date}`,
          contactExternalId: `sms-${address}`,
          type: 'message',
          subject: `SMS ${direction}`,
          body: preview,
          date: row.date,
        })
      }
    } finally {
      db.close()
    }

    return { contacts, interactions }
  }
}

/**
 * Attempt to auto-detect the Phone Link SMS database path.
 */
export function detectPhoneLinkDb(): { found: boolean; path: string | null } {
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return { found: false, path: null }

  // Known Phone Link package paths
  const candidates = [
    path.join(localAppData, 'Packages', 'Microsoft.YourPhone_8wekyb3d8bbse', 'LocalCache', 'Indexed', 'NOTIFICATIONS', 'PhoneLinkSMS.db'),
    path.join(localAppData, 'Packages', 'Microsoft.YourPhone_8wekyb3d8bbse', 'LocalCache', 'PhoneLinkSMS.db'),
  ]

  // Also search recursively in the YourPhone package
  const yourPhoneBase = path.join(localAppData, 'Packages', 'Microsoft.YourPhone_8wekyb3d8bbse')
  if (fs.existsSync(yourPhoneBase)) {
    try {
      const findDb = (dir: string, depth: number): string | null => {
        if (depth > 4) return null
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isFile() && entry.name.toLowerCase().includes('sms') && entry.name.endsWith('.db')) {
            return fullPath
          }
          if (entry.isDirectory() && depth < 4) {
            const found = findDb(fullPath, depth + 1)
            if (found) return found
          }
        }
        return null
      }
      const found = findDb(yourPhoneBase, 0)
      if (found) candidates.unshift(found)
    } catch {
      // Permission denied or similar — ignore
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { found: true, path: candidate }
    }
  }

  return { found: false, path: null }
}
