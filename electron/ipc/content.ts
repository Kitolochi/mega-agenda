import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import initSqlJs from 'sql.js'
import {
  getContentDrafts,
  getContentDraft,
  createContentDraft,
  updateContentDraft,
  deleteContentDraft,
  getScoreSnapshots,
  getTweetPatterns,
} from '../database'
import {
  researchTopic,
  abortResearch,
  streamContentDraft,
  abortDraft,
  extractPatterns,
} from '../content-writer'

const AGENTSVIEW_DB = path.join(os.homedir(), '.agentsview', 'sessions.db')

interface SessionInsight {
  id: number
  date_from: string
  date_to: string
  project: string | null
  tweets: { text: string; theme: string; format?: string; source_project?: string }[]
  created_at: string
}

async function getSessionInsights(): Promise<SessionInsight[]> {
  if (!fs.existsSync(AGENTSVIEW_DB)) return []

  const SQL = await initSqlJs()
  const buffer = fs.readFileSync(AGENTSVIEW_DB)
  const db = new SQL.Database(buffer)

  const stmt = db.prepare(`
    SELECT id, date_from, date_to, project, content, created_at
    FROM insights
    WHERE type = 'daily-tweets'
    ORDER BY created_at DESC
    LIMIT 20
  `)

  const results: SessionInsight[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: number; date_from: string; date_to: string; project: string | null; content: string; created_at: string }
    try {
      const tweets = JSON.parse(row.content as string)
      results.push({
        id: row.id as number,
        date_from: row.date_from as string,
        date_to: row.date_to as string,
        project: row.project as string | null,
        tweets,
        created_at: row.created_at as string,
      })
    } catch { /* skip malformed rows */ }
  }
  stmt.free()
  db.close()
  return results
}

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
  ipcMain.handle('content-generate', async (_, draftId: string, messages: { role: string; content: string }[], contentType: string) => {
    await streamContentDraft(mainWindow, draftId, messages, contentType)
  })
  ipcMain.handle('content-abort', () => {
    abortDraft()
  })

  // Score history & patterns
  ipcMain.handle('get-score-snapshots', () => getScoreSnapshots())
  ipcMain.handle('get-tweet-patterns', () => getTweetPatterns())
  ipcMain.handle('extract-tweet-patterns', () => extractPatterns())

  // Session insights from AgentsView
  ipcMain.handle('get-session-insights', () => getSessionInsights())
  ipcMain.handle('import-session-tweet', (_, text: string, topic: string) => {
    const draft = createContentDraft(topic)
    updateContentDraft(draft.id, {
      content: text,
      contentType: 'tweet',
      status: 'ready',
    })
    return draft
  })
}
