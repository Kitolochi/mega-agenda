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
} from '../outreach-db'
import { generatePersonalizedMessage, generateBatchMessages } from '../outreach-messages'

export function registerOutreachHandlers(mainWindow: BrowserWindow) {
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
