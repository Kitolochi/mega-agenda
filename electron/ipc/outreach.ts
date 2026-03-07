import https from 'https'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { ipcMain, BrowserWindow, app } from 'electron'
import {
  getBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  getBusinessContacts,
  createContact,
  getBusinessOutreach,
  createOutreach,
  updateOutreach,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getPipelineStats,
  getAllOutreachSettings,
  getOutreachSetting,
  setOutreachSetting,
  getBusinessCount,
  initOutreachTables,
  seedDefaultTemplates,
} from '../outreach-db'
import type { OutreachSettings } from '../outreach-db'
import { generatePersonalizedMessage, generateBatchMessages } from '../outreach-messages'
import { seedCharlotteBusinesses } from '../outreach-seed'
import {
  gwsCheckAuth,
  gmailSend,
  calendarCreateEvent,
  sheetsExportPipeline,
  driveUploadFile,
} from '../gws-bridge'

function httpsGetStatus(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 500, body: data.slice(0, 500) })
      })
    })
    req.on('error', (err) => {
      resolve({ ok: false, status: 0, body: err.message })
    })
    req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, status: 0, body: 'Timeout' }) })
  })
}

export function registerOutreachHandlers(mainWindow: BrowserWindow) {
  try {
    initOutreachTables()
    seedDefaultTemplates()
  } catch (err) {
    console.error('[outreach] Failed to initialize database:', err)
  }

  // ── Settings ──
  ipcMain.handle('get-outreach-settings', () => getAllOutreachSettings())

  ipcMain.handle('set-outreach-setting', (_, key: keyof OutreachSettings, value: string) => {
    setOutreachSetting(key, value)
    return getAllOutreachSettings()
  })

  ipcMain.handle('get-outreach-business-count', () => getBusinessCount())

  ipcMain.handle('validate-api-key', async (_, keyType: 'google_places' | 'apollo', apiKey: string) => {
    if (keyType === 'google_places') {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${encodeURIComponent(apiKey)}`
      const res = await httpsGetStatus(url)
      try {
        const parsed = JSON.parse(res.body)
        if (parsed.status === 'OK' || parsed.status === 'ZERO_RESULTS') {
          return { valid: true, message: 'Google Places API key is valid' }
        }
        return { valid: false, message: parsed.error_message || `API returned status: ${parsed.status}` }
      } catch {
        return { valid: false, message: `HTTP ${res.status}: ${res.body}` }
      }
    }

    if (keyType === 'apollo') {
      // Apollo health check: search for a dummy person
      const url = `https://api.apollo.io/api/v1/people/search`
      return new Promise<{ valid: boolean; message: string }>((resolve) => {
        const postData = JSON.stringify({ api_key: apiKey, page: 1, per_page: 1 })
        const req = https.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
          timeout: 10000,
        }, (res) => {
          let data = ''
          res.on('data', (chunk: string) => { data += chunk })
          res.on('end', () => {
            if ((res.statusCode ?? 500) < 400) {
              resolve({ valid: true, message: 'Apollo API key is valid' })
            } else {
              resolve({ valid: false, message: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` })
            }
          })
        })
        req.on('error', (err) => resolve({ valid: false, message: err.message }))
        req.on('timeout', () => { req.destroy(); resolve({ valid: false, message: 'Request timeout' }) })
        req.write(postData)
        req.end()
      })
    }

    return { valid: false, message: `Unknown key type: ${keyType}` }
  })

  // ── Seed Discovery ──
  ipcMain.handle('run-seed-discovery', async () => {
    const result = await seedCharlotteBusinesses((progress) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('seed-progress', progress)
      }
    })
    return result
  })

  // ── Auto-Research (full pipeline: discover + enrich) ──
  ipcMain.handle('run-auto-research', async () => {
    const send = (data: any) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-research-progress', data)
      }
    }

    // Phase 1: Discover businesses
    send({ phase: 'discover', status: 'starting', message: 'Starting business discovery...' })
    let discovered = 0
    try {
      const seedResult = await seedCharlotteBusinesses((progress) => {
        send({
          phase: 'discover',
          status: 'running',
          message: `Searching: ${progress.category}`,
          category: progress.category,
          categoryIndex: progress.categoryIndex,
          totalCategories: progress.totalCategories,
          imported: progress.totalImported,
        })
      })
      discovered = seedResult.totalImported
      send({ phase: 'discover', status: 'done', message: `Found ${discovered} businesses`, imported: discovered })
    } catch (err: any) {
      send({ phase: 'discover', status: 'error', message: err.message || 'Discovery failed' })
      return { discovered: 0, enriched: 0, contactsFound: 0, socialLinksFound: 0, error: err.message }
    }

    // Phase 2: Enrich all "New" businesses
    const newBusinesses = getBusinesses({ status: 'New' })
    if (newBusinesses.length === 0) {
      send({ phase: 'enrich', status: 'done', message: 'No new businesses to enrich' })
      return { discovered, enriched: 0, contactsFound: 0, socialLinksFound: 0 }
    }

    send({ phase: 'enrich', status: 'starting', message: `Enriching ${newBusinesses.length} businesses...` })
    const apolloKey = getOutreachSetting('apollo_api_key')

    try {
      const { enrichBusinesses } = await import('../outreach-enrichment')
      const enrichResult = await enrichBusinesses(
        newBusinesses.map(b => b.id),
        {
          socialLinks: true,
          contacts: !!apolloKey,
          apolloApiKey: apolloKey || undefined,
          delayBetweenBusinesses: 1500,
          delayBetweenRequests: 800,
        },
        (progress) => {
          send({
            phase: 'enrich',
            status: 'running',
            message: `Enriching: ${progress.businessName} (${progress.phase})`,
            current: progress.current,
            total: progress.total,
            businessName: progress.businessName,
            enrichPhase: progress.phase,
          })
        },
      )
      send({
        phase: 'enrich',
        status: 'done',
        message: `Enriched ${enrichResult.enriched} businesses`,
      })
      return {
        discovered,
        enriched: enrichResult.enriched,
        contactsFound: enrichResult.contactsFound,
        socialLinksFound: enrichResult.socialLinksFound,
      }
    } catch (err: any) {
      send({ phase: 'enrich', status: 'error', message: err.message || 'Enrichment failed' })
      return { discovered, enriched: 0, contactsFound: 0, socialLinksFound: 0, error: err.message }
    }
  })

  // Search & Scrape (placeholders)
  ipcMain.handle('search-businesses', async (_e, _query: string, _location?: string) => [])
  ipcMain.handle('scrape-businesses', async (_e, _urls: string[]) => [])

  // Businesses CRUD
  ipcMain.handle('get-businesses', (_, filters?: any) => getBusinesses(filters))
  ipcMain.handle('get-business', (_, id: string) => getBusiness(id))
  ipcMain.handle('import-businesses', (_, businesses: any[]) => {
    return businesses.map((b: any) => createBusiness(b))
  })
  ipcMain.handle('update-business', (_, id: string, updates: any) => updateBusiness(id, updates))
  ipcMain.handle('delete-business', (_, id: string) => deleteBusiness(id))

  // Enrichment (placeholder)
  ipcMain.handle('enrich-business', async (_e, _id: string) => null)

  // Contacts
  ipcMain.handle('get-business-contacts', (_, businessId: string) => getBusinessContacts(businessId))
  ipcMain.handle('create-contact', (_, data: any) => createContact(data))

  // Outreach history
  ipcMain.handle('get-outreach-history', (_, businessId: string) => getBusinessOutreach(businessId))
  ipcMain.handle('create-outreach', (_, data: any) => createOutreach(data))

  // Templates
  ipcMain.handle('get-templates', () => getTemplates())
  ipcMain.handle('create-template', (_, data: any) => createTemplate(data))
  ipcMain.handle('update-template', (_, id: string, updates: any) => updateTemplate(id, updates))
  ipcMain.handle('delete-template', (_, id: string) => deleteTemplate(id))

  // AI message generation
  ipcMain.handle('generate-message', async (_, templateId: string, businessId: string, options: any) => {
    const business = getBusiness(businessId)
    if (!business) throw new Error(`Business not found: ${businessId}`)

    const contacts = getBusinessContacts(businessId)
    const contact = contacts.length > 0 ? contacts[0] : undefined

    return generatePersonalizedMessage(templateId, business, contact, {
      serviceOffering: options?.serviceOffering || '',
      resumeLink: options?.resumeLink || '',
    })
  })

  // Batch message generation
  ipcMain.handle('generate-batch-messages', async (_, businessIds: string[], templateId: string, options: any) => {
    return generateBatchMessages(
      businessIds,
      templateId,
      {
        serviceOffering: options?.serviceOffering || '',
        resumeLink: options?.resumeLink || '',
      },
      (progress) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('batch-message-progress', progress)
        }
      },
    )
  })

  // Pipeline stats
  ipcMain.handle('get-pipeline-stats', () => getPipelineStats())

  // ── Update outreach record ──
  ipcMain.handle('update-outreach', (_, id: string, updates: any) => updateOutreach(id, updates))

  // ── Google Workspace CLI ──

  ipcMain.handle('gws-check-auth', async () => {
    const status = await gwsCheckAuth()
    setOutreachSetting('gws_installed', status.installed ? 'true' : '')
    setOutreachSetting('gws_authenticated', status.authenticated ? 'true' : '')
    return status
  })

  ipcMain.handle('gws-send-email', async (_, params: {
    outreachId?: string
    businessId: string
    to: string
    subject: string
    body: string
  }) => {
    const fromEmail = getOutreachSetting('gws_user_email') || undefined
    const result = await gmailSend(params.to, params.subject, params.body, fromEmail)

    if (result.success) {
      // Save as outreach record if outreachId provided, otherwise create new
      if (params.outreachId) {
        updateOutreach(params.outreachId, {
          status: 'sent',
          sentAt: new Date().toISOString(),
        })
      } else {
        createOutreach({
          businessId: params.businessId,
          channel: 'email',
          messageText: params.body,
          status: 'sent',
          sentAt: new Date().toISOString(),
        })
      }

      // Auto-update business status to 'Contacted' if currently 'New'
      const biz = getBusiness(params.businessId)
      if (biz && biz.status === 'New') {
        updateBusiness(params.businessId, { status: 'Contacted' })
      }
    }

    return result
  })

  ipcMain.handle('gws-create-event', async (_, params: {
    businessId: string
    summary: string
    startDateTime: string
    endDateTime: string
    attendeeEmail?: string
    description?: string
  }) => {
    const result = await calendarCreateEvent({
      summary: params.summary,
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      attendeeEmail: params.attendeeEmail,
      description: params.description,
    })

    if (result.success) {
      updateBusiness(params.businessId, { status: 'Meeting Scheduled' })
    }

    return result
  })

  ipcMain.handle('gws-export-sheets', async () => {
    const allBusinesses = getBusinesses()
    const header = ['Name', 'Address', 'Phone', 'Website', 'Category', 'Status', 'Rating', 'Notes', 'Created']
    const rows = [header, ...allBusinesses.map(b => [
      b.name,
      b.address,
      b.phone,
      b.website,
      b.category,
      b.status,
      b.rating?.toString() || '',
      b.notes,
      b.createdAt,
    ])]
    const title = `Outreach Pipeline — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    return sheetsExportPipeline(title, rows)
  })

  ipcMain.handle('gws-upload-drive', async (_, params: { format: 'csv' | 'json' }) => {
    const allBusinesses = getBusinesses()
    const tmpDir = os.tmpdir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `outreach-pipeline-${timestamp}.${params.format}`
    const tmpPath = path.join(tmpDir, fileName)

    try {
      if (params.format === 'csv') {
        const header = 'Name,Address,Phone,Website,Category,Status,Rating,Notes,Created'
        const csvRows = allBusinesses.map(b => {
          const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
          return [
            escape(b.name), escape(b.address), escape(b.phone), escape(b.website),
            escape(b.category), escape(b.status), b.rating?.toString() || '',
            escape(b.notes), escape(b.createdAt),
          ].join(',')
        })
        fs.writeFileSync(tmpPath, [header, ...csvRows].join('\n'), 'utf-8')
      } else {
        fs.writeFileSync(tmpPath, JSON.stringify(allBusinesses, null, 2), 'utf-8')
      }

      const result = await driveUploadFile(fileName, tmpPath)
      return result
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    }
  })
}
