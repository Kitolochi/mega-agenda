import { ipcMain, BrowserWindow } from 'electron'
import { getDailyNote, saveDailyNote, getRecentNotes } from '../database'

export function registerNoteHandlers(_mainWindow: BrowserWindow) {
  ipcMain.handle('get-daily-note', (_, date: string) => {
    return getDailyNote(date)
  })

  ipcMain.handle('save-daily-note', (_, date: string, content: string) => {
    return saveDailyNote(date, content)
  })

  ipcMain.handle('get-recent-notes', (_, limit?: number) => {
    return getRecentNotes(limit)
  })
}
