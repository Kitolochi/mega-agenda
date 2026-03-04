import https from 'https'
import { ipcMain, BrowserWindow } from 'electron'
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
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getPipelineStats,
  getAllOutreachSettings,
  getOutreachSetting,
  setOutreachSetting,
  getBusinessCount,
} from '../outreach-db'
import type { OutreachSettings } from '../outreach-db'
import { generatePersonalizedMessage, generateBatchMessages } from '../outreach-messages'
import { seedCharlotteBusinesses } from '../outreach-seed'

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
}
