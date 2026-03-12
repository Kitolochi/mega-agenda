import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  initCommandCenter,
  launchProcess,
  respondToProcess,
  dismissProcess,
  killProcess,
  getQueue,
} from '../command-center'
import {
  getCCHistory,
  addCCHistoryEntry,
  getKnownProjects,
  upsertKnownProject,
  discoverProjects,
} from '../database'
import path from 'path'
import crypto from 'crypto'

export function registerCommandCenterHandlers(mainWindow: BrowserWindow) {
  initCommandCenter(mainWindow)

  ipcMain.handle('cc:launch', async (_, opts: { projectPath: string; prompt: string; model?: string; maxBudget?: number }) => {
    upsertKnownProject(opts.projectPath)
    return launchProcess(opts)
  })

  ipcMain.handle('cc:respond', (_, opts: { processId: string; response: string }) => {
    respondToProcess(opts.processId, opts.response)
  })

  ipcMain.handle('cc:dismiss', (_, opts: { processId: string }) => {
    const item = dismissProcess(opts.processId)
    if (item) {
      // Generate summary from last assistant text
      let summary = item.resultText || 'Task completed'
      if (summary.length > 200) {
        const firstSentence = summary.match(/^[^.!?]+[.!?]/)
        summary = firstSentence ? firstSentence[0] + '...' : summary.slice(0, 200) + '...'
      }

      addCCHistoryEntry({
        id: crypto.randomUUID(),
        projectPath: item.projectPath,
        projectName: item.projectName,
        projectColor: item.projectColor,
        prompt: item.prompt,
        summary,
        filesChanged: item.filesChanged,
        costUsd: item.costUsd,
        turnCount: item.turnCount,
        startedAt: item.startedAt,
        completedAt: Date.now(),
      })
    }
    return item
  })

  ipcMain.handle('cc:kill', (_, opts: { processId: string }) => {
    killProcess(opts.processId)
  })

  ipcMain.handle('cc:get-queue', () => {
    return getQueue()
  })

  ipcMain.handle('cc:get-history', (_, opts?: { filter?: string; limit?: number; offset?: number }) => {
    return getCCHistory(opts?.filter, opts?.limit)
  })

  ipcMain.handle('cc:get-projects', () => {
    return discoverProjects()
  })

  ipcMain.handle('cc:browse-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const projectPath = result.filePaths[0]
    upsertKnownProject(projectPath)
    return { path: projectPath, name: path.basename(projectPath) }
  })
}
