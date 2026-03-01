import { ipcMain, BrowserWindow } from 'electron'
import { getTwitterSettings, saveTwitterSettings, getTweetDrafts, getTweetDraft, createTweetDraft, updateTweetDraft, addTweetAIMessage, deleteTweetDraft, getTweetPersonas, createTweetPersona, deleteTweetPersona } from '../database'
import { verifyToken, getUserByUsername, getUserLists, fetchAllLists, postTweet, verifyOAuthCredentials } from '../twitter'
import { brainstormTweet, brainstormThread, refineTweet, analyzeTweet } from '../tweet-ai'
import { isLLMConfigured } from '../llm'

export function registerTwitterHandlers(_mainWindow: BrowserWindow) {
  // Twitter settings
  ipcMain.handle('get-twitter-settings', () => {
    return getTwitterSettings()
  })

  ipcMain.handle('save-twitter-settings', (_, settings) => {
    return saveTwitterSettings(settings)
  })

  ipcMain.handle('verify-twitter-token', async (_, bearerToken: string) => {
    return verifyToken(bearerToken)
  })

  ipcMain.handle('twitter-get-user', async (_, bearerToken: string, username: string) => {
    return getUserByUsername(bearerToken, username)
  })

  ipcMain.handle('twitter-get-lists', async (_, bearerToken: string, userId: string) => {
    return getUserLists(bearerToken, userId)
  })

  ipcMain.handle('twitter-fetch-feed', async (_, bearerToken: string, lists: { id: string; name: string }[]) => {
    return fetchAllLists(bearerToken, lists)
  })

  // Tweet posting
  ipcMain.handle('post-tweet', async (_, text: string, replyToTweetId?: string) => {
    const settings = getTwitterSettings()
    if (!settings.apiKey || !settings.apiSecret || !settings.accessToken || !settings.accessTokenSecret) {
      return { success: false, error: 'Twitter OAuth credentials not configured. Set them in Settings.' }
    }
    return postTweet({ apiKey: settings.apiKey, apiSecret: settings.apiSecret, accessToken: settings.accessToken, accessTokenSecret: settings.accessTokenSecret }, text, replyToTweetId)
  })

  ipcMain.handle('verify-twitter-oauth', async () => {
    const settings = getTwitterSettings()
    if (!settings.apiKey || !settings.apiSecret || !settings.accessToken || !settings.accessTokenSecret) {
      return { valid: false, error: 'Missing credentials' }
    }
    return verifyOAuthCredentials({ apiKey: settings.apiKey, apiSecret: settings.apiSecret, accessToken: settings.accessToken, accessTokenSecret: settings.accessTokenSecret })
  })

  // Tweet Drafts
  ipcMain.handle('get-tweet-drafts', () => {
    return getTweetDrafts()
  })

  ipcMain.handle('get-tweet-draft', (_, id: string) => {
    return getTweetDraft(id)
  })

  ipcMain.handle('create-tweet-draft', (_, topic?: string) => {
    return createTweetDraft(topic)
  })

  ipcMain.handle('update-tweet-draft', (_, id: string, updates: any) => {
    return updateTweetDraft(id, updates)
  })

  ipcMain.handle('add-tweet-ai-message', (_, draftId: string, msg: any) => {
    return addTweetAIMessage(draftId, msg)
  })

  ipcMain.handle('delete-tweet-draft', (_, id: string) => {
    return deleteTweetDraft(id)
  })

  // Tweet AI
  ipcMain.handle('tweet-brainstorm', async (_, topic: string, history: { role: string; content: string }[], persona?: any) => {
    if (!isLLMConfigured()) throw new Error('No AI provider configured')
    return brainstormTweet(topic, history, persona || undefined)
  })

  ipcMain.handle('tweet-brainstorm-thread', async (_, topic: string, history: { role: string; content: string }[], persona?: any) => {
    if (!isLLMConfigured()) throw new Error('No AI provider configured')
    return brainstormThread(topic, history, persona || undefined)
  })

  ipcMain.handle('tweet-refine', async (_, text: string, instruction: string, history: { role: string; content: string }[], persona?: any) => {
    if (!isLLMConfigured()) throw new Error('No AI provider configured')
    return refineTweet(text, instruction, history, persona || undefined)
  })

  ipcMain.handle('tweet-analyze', async (_, text: string) => {
    if (!isLLMConfigured()) throw new Error('No AI provider configured')
    return analyzeTweet(text)
  })

  // Tweet Personas
  ipcMain.handle('get-tweet-personas', () => {
    return getTweetPersonas()
  })

  ipcMain.handle('create-tweet-persona', (_, persona: { name: string; description: string; exampleTweets: string[] }) => {
    return createTweetPersona(persona)
  })

  ipcMain.handle('delete-tweet-persona', (_, id: string) => {
    return deleteTweetPersona(id)
  })
}
