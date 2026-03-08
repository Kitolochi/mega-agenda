import { ipcMain, BrowserWindow } from 'electron'
import { streamGuideChatMessage, abortGuideChatStream } from '../guide-chat'

export function registerGuideChatHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('guide-chat-send', (_, messages: { role: string; content: string }[]) => {
    if (mainWindow) {
      streamGuideChatMessage(mainWindow, messages)
    }
  })

  ipcMain.handle('guide-chat-abort', () => {
    abortGuideChatStream()
  })
}
