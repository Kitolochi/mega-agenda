import { ipcMain, BrowserWindow } from 'electron'
import { getKnowledgePacks, compressKnowledgeNative } from '../knowledge-pack'
import { getMemoryHealth, autoPrune, startHealthMonitor, stopHealthMonitor } from '../memory-health'

export function registerKnowledgePackHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('get-knowledge-packs', () => {
    return getKnowledgePacks()
  })

  ipcMain.handle('compress-knowledge', async () => {
    const pack = await compressKnowledgeNative((progress) => {
      mainWindow.webContents.send('compression-progress', progress)
    })
    return pack
  })

  ipcMain.handle('get-memory-health', () => {
    return getMemoryHealth()
  })

  ipcMain.handle('auto-prune-memories', () => {
    return autoPrune()
  })

  ipcMain.handle('start-health-monitor', (_, intervalMs: number) => {
    startHealthMonitor(intervalMs || 60000, (health) => {
      mainWindow.webContents.send('memory-health-update', health)
    })
  })

  ipcMain.handle('stop-health-monitor', () => {
    stopHealthMonitor()
  })
}
