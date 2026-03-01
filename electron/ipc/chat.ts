import { ipcMain, BrowserWindow } from 'electron'
import { getChatConversations, getChatConversation, createChatConversation, addChatMessage, deleteChatConversation, renameChatConversation, getChatSettings, saveChatSettings } from '../database'
import { streamChatMessage, abortChatStream, getMemoryCountForChat } from '../chat'

export function registerChatHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('get-chat-conversations', () => {
    return getChatConversations()
  })

  ipcMain.handle('get-chat-conversation', (_, id: string) => {
    return getChatConversation(id)
  })

  ipcMain.handle('create-chat-conversation', (_, title: string) => {
    return createChatConversation(title)
  })

  ipcMain.handle('add-chat-message', (_, conversationId: string, message: any) => {
    return addChatMessage(conversationId, message)
  })

  ipcMain.handle('delete-chat-conversation', (_, id: string) => {
    return deleteChatConversation(id)
  })

  ipcMain.handle('rename-chat-conversation', (_, id: string, title: string) => {
    return renameChatConversation(id, title)
  })

  // Chat settings
  ipcMain.handle('get-chat-settings', () => {
    return getChatSettings()
  })

  ipcMain.handle('save-chat-settings', (_, settings: any) => {
    return saveChatSettings(settings)
  })

  // Chat streaming
  ipcMain.handle('chat-send-message', (_, conversationId: string, messages: { role: string; content: string }[], systemPrompt?: string) => {
    if (mainWindow) {
      streamChatMessage(mainWindow, conversationId, messages, systemPrompt)
    }
  })

  ipcMain.handle('chat-abort', () => {
    abortChatStream()
  })

  ipcMain.handle('get-memory-count-for-chat', (_, messages: { role: string; content: string }[]) => {
    return getMemoryCountForChat(messages)
  })
}
