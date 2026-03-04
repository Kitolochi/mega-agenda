import { BrowserWindow, ipcMain } from 'electron'
import {
  getContentDrafts,
  getContentDraft,
  createContentDraft,
  updateContentDraft,
  deleteContentDraft,
} from '../database'
import {
  researchTopic,
  abortResearch,
  streamContentDraft,
  abortDraft,
} from '../content-writer'

export function registerContentHandlers(mainWindow: BrowserWindow) {
  // CRUD
  ipcMain.handle('get-content-drafts', () => getContentDrafts())
  ipcMain.handle('get-content-draft', (_, id: string) => getContentDraft(id))
  ipcMain.handle('create-content-draft', (_, topic?: string) => createContentDraft(topic))
  ipcMain.handle('update-content-draft', (_, id: string, updates: any) => updateContentDraft(id, updates))
  ipcMain.handle('delete-content-draft', (_, id: string) => deleteContentDraft(id))

  // Research
  ipcMain.handle('content-research', (_, draftId: string, topic: string) => {
    researchTopic(mainWindow, draftId, topic)
  })
  ipcMain.handle('content-research-abort', () => {
    abortResearch()
  })

  // Draft generation
  ipcMain.handle('content-generate', (_, draftId: string, messages: { role: string; content: string }[], contentType: string) => {
    streamContentDraft(mainWindow, draftId, messages, contentType)
  })
  ipcMain.handle('content-abort', () => {
    abortDraft()
  })
}
