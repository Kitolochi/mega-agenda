import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification, clipboard } from 'electron'
import path from 'path'
import { initDatabase, getCategories, getTasks, addTask, updateTask, deleteTask, toggleTaskComplete, getDailyNote, saveDailyNote, getRecentNotes, getStats, getTwitterSettings, saveTwitterSettings, getRSSFeeds, addRSSFeed, removeRSSFeed, getClaudeApiKey, saveClaudeApiKey, getActivityLog, getPomodoroState, startPomodoro, completePomodoro, startBreak, stopPomodoro, getMorningBriefing, saveMorningBriefing, dismissMorningBriefing, getBriefingData, getWeeklyReview, saveWeeklyReview, getAllWeeklyReviews, getWeeklyReviewData, checkWeeklyReviewNeeded, getChatConversations, getChatConversation, createChatConversation, addChatMessage, deleteChatConversation, renameChatConversation, getChatSettings, saveChatSettings, addCategory, deleteCategory, getTweetDrafts, getTweetDraft, createTweetDraft, updateTweetDraft, addTweetAIMessage, deleteTweetDraft, getTweetPersonas, createTweetPersona, deleteTweetPersona, getAITasks, createAITask, updateAITask, deleteAITask, moveAITask } from './database'
import { verifyToken, getUserByUsername, getUserLists, fetchAllLists, postTweet, verifyOAuthCredentials } from './twitter'
import { fetchAllFeeds } from './rss'
import { summarizeAI, summarizeGeo, verifyClaudeKey, parseVoiceCommand, generateMorningBriefing, generateWeeklyReview } from './summarize'
import { brainstormTweet, brainstormThread, refineTweet, analyzeTweet } from './tweet-ai'
import { createTerminal, writeTerminal, resizeTerminal, killTerminal } from './terminal'
import { streamChatMessage, abortChatStream } from './chat'
import { getCliSessions, getCliSessionMessages, searchCliSessions } from './cli-logs'
import { searchGitHubRepos } from './github'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // Don't auto-open DevTools
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })
}

function createTray() {
  // Load icon from file - works better on Windows
  const iconPath = path.join(app.getAppPath(), 'public', 'tray-icon.png')
  let trayIcon = nativeImage.createFromPath(iconPath)

  // Fallback to embedded if file not found
  if (trayIcon.isEmpty()) {
    const icon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2NkoBAwUqifgWoGjBowasCoAQNvwFAIAwDkfQER39Vg/AAAAABJRU5ErkJggg=='
    trayIcon = nativeImage.createFromDataURL(`data:image/png;base64,${icon16Base64}`)
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Mega Agenda')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => showWindow()
    },
    {
      label: 'Quick Add Task',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('open-add-modal')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow?.destroy()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showWindow()
  })
}

function showWindow() {
  if (!mainWindow) return

  const trayBounds = tray?.getBounds()
  if (trayBounds) {
    const windowBounds = mainWindow.getBounds()
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
    const y = Math.round(trayBounds.y - windowBounds.height - 10)
    mainWindow.setPosition(x, y, false)
  }

  mainWindow.show()
  mainWindow.focus()
}

// Task IPC Handlers
ipcMain.handle('get-categories', () => {
  return getCategories()
})

ipcMain.handle('add-category', (_, name: string, color: string, icon: string) => {
  return addCategory(name, color, icon)
})

ipcMain.handle('delete-category', (_, id: number) => {
  return deleteCategory(id)
})

ipcMain.handle('get-tasks', (_, categoryId?: number) => {
  return getTasks(categoryId)
})

ipcMain.handle('add-task', (_, task) => {
  return addTask(task)
})

ipcMain.handle('update-task', (_, id: number, updates) => {
  return updateTask(id, updates)
})

ipcMain.handle('delete-task', (_, id: number) => {
  return deleteTask(id)
})

ipcMain.handle('toggle-task', (_, id: number) => {
  return toggleTaskComplete(id)
})

// Notes IPC Handlers
ipcMain.handle('get-daily-note', (_, date: string) => {
  return getDailyNote(date)
})

ipcMain.handle('save-daily-note', (_, date: string, content: string) => {
  return saveDailyNote(date, content)
})

ipcMain.handle('get-recent-notes', (_, limit?: number) => {
  return getRecentNotes(limit)
})

// Stats handler
ipcMain.handle('get-stats', () => {
  return getStats()
})

// Twitter handlers
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

// RSS handlers
ipcMain.handle('get-rss-feeds', () => {
  return getRSSFeeds()
})

ipcMain.handle('add-rss-feed', (_, url: string, name: string, category: string) => {
  return addRSSFeed({ url, name, category: category || 'ai' })
})

ipcMain.handle('remove-rss-feed', (_, url: string) => {
  return removeRSSFeed(url)
})

ipcMain.handle('fetch-rss-feeds', async (_, feeds: { url: string; name: string; category: string }[]) => {
  return fetchAllFeeds(feeds)
})

// Claude API
ipcMain.handle('get-claude-api-key', () => {
  return getClaudeApiKey()
})

ipcMain.handle('save-claude-api-key', (_, key: string) => {
  saveClaudeApiKey(key)
  return true
})

ipcMain.handle('verify-claude-key', async (_, key: string) => {
  return verifyClaudeKey(key)
})

ipcMain.handle('summarize-feed', async (_, apiKey: string, articles: { title: string; description: string }[], section: string) => {
  if (section === 'ai') return summarizeAI(apiKey, articles)
  if (section === 'geo') return summarizeGeo(apiKey, articles)
  return summarizeAI(apiKey, articles)
})

// Voice command parsing
ipcMain.handle('parse-voice-command', async (_, apiKey: string, transcript: string, categoryNames: string[]) => {
  return parseVoiceCommand(apiKey, transcript, categoryNames)
})

// Activity Log
ipcMain.handle('get-activity-log', (_, days?: number) => {
  return getActivityLog(days)
})

// Pomodoro
ipcMain.handle('get-pomodoro-state', () => {
  return getPomodoroState()
})

ipcMain.handle('start-pomodoro', (_, taskId: number | null, taskTitle: string, durationMinutes?: number) => {
  return startPomodoro(taskId, taskTitle, durationMinutes)
})

ipcMain.handle('complete-pomodoro', () => {
  return completePomodoro()
})

ipcMain.handle('start-break', (_, type: 'short_break' | 'long_break') => {
  return startBreak(type)
})

ipcMain.handle('stop-pomodoro', () => {
  return stopPomodoro()
})

// Morning Briefing
ipcMain.handle('get-morning-briefing', (_, date: string) => {
  return getMorningBriefing(date)
})

ipcMain.handle('generate-morning-briefing', async () => {
  const today = new Date().toISOString().split('T')[0]
  const existing = getMorningBriefing(today)
  if (existing) return existing

  const data = getBriefingData()
  const apiKey = getClaudeApiKey()

  let content: string
  let isAiEnhanced = false

  if (apiKey) {
    try {
      content = await generateMorningBriefing(apiKey, data)
      isAiEnhanced = true
    } catch {
      content = buildLocalBriefing(data)
    }
  } else {
    content = buildLocalBriefing(data)
  }

  const briefing = {
    date: today,
    content,
    isAiEnhanced,
    dismissed: false,
    generatedAt: new Date().toISOString()
  }
  return saveMorningBriefing(briefing)
})

ipcMain.handle('dismiss-morning-briefing', (_, date: string) => {
  return dismissMorningBriefing(date)
})

// Weekly Review
ipcMain.handle('get-weekly-review', (_, weekStart: string) => {
  return getWeeklyReview(weekStart)
})

ipcMain.handle('get-all-weekly-reviews', () => {
  return getAllWeeklyReviews()
})

ipcMain.handle('generate-weekly-review', async (_, weekStart: string) => {
  const existing = getWeeklyReview(weekStart)
  if (existing) return existing

  const data = getWeeklyReviewData(weekStart)
  const apiKey = getClaudeApiKey()
  const categories = getCategories()

  let content: string
  if (apiKey) {
    try {
      content = await generateWeeklyReview(apiKey, {
        completedTasks: data.completedTasks.map(t => ({
          title: t.title,
          category: categories.find(c => c.id === t.category_id)?.name || 'Unknown',
          priority: t.priority
        })),
        focusMinutes: data.focusMinutes,
        notesCount: data.notesWritten.length,
        categoriesWorked: data.categoriesWorked,
        streak: data.streak
      })
    } catch {
      content = buildLocalWeeklyReview(data)
    }
  } else {
    content = buildLocalWeeklyReview(data)
  }

  const review = {
    weekStartDate: weekStart,
    content,
    generatedAt: new Date().toISOString(),
    tasksCompletedCount: data.completedTasks.length,
    categoriesWorked: data.categoriesWorked,
    streakAtGeneration: data.streak
  }
  return saveWeeklyReview(review)
})

ipcMain.handle('check-weekly-review-needed', () => {
  return checkWeeklyReviewNeeded()
})

// Notifications
ipcMain.handle('show-notification', (_, title: string, body: string) => {
  new Notification({ title, body }).show()
})

function buildLocalBriefing(data: ReturnType<typeof getBriefingData>): string {
  const lines: string[] = []
  if (data.overdueTasks.length > 0) {
    lines.push(`You have ${data.overdueTasks.length} overdue task${data.overdueTasks.length > 1 ? 's' : ''} that need attention.`)
  }
  if (data.todayTasks.length > 0) {
    lines.push(`${data.todayTasks.length} task${data.todayTasks.length > 1 ? 's' : ''} due today.`)
  }
  if (data.highPriorityTasks.length > 0) {
    lines.push(`${data.highPriorityTasks.length} high priority task${data.highPriorityTasks.length > 1 ? 's' : ''}: ${data.highPriorityTasks.slice(0, 3).map(t => t.title).join(', ')}`)
  }
  if (data.streak > 0) {
    lines.push(`You're on a ${data.streak}-day streak! Keep it going.`)
  }
  if (data.stats.tasksCompletedThisWeek > 0) {
    lines.push(`${data.stats.tasksCompletedThisWeek} tasks completed this week so far.`)
  }
  if (lines.length === 0) {
    lines.push('No pressing items today. A great day to get ahead!')
  }
  return lines.map(l => `- ${l}`).join('\n')
}

function buildLocalWeeklyReview(data: ReturnType<typeof getWeeklyReviewData>): string {
  const lines: string[] = []
  lines.push(`**Week Summary**`)
  lines.push(`- Completed ${data.completedTasks.length} task${data.completedTasks.length !== 1 ? 's' : ''}`)
  if (data.focusMinutes > 0) {
    lines.push(`- ${data.focusMinutes} minutes of focused work`)
  }
  if (data.notesWritten.length > 0) {
    lines.push(`- Wrote ${data.notesWritten.length} journal entr${data.notesWritten.length !== 1 ? 'ies' : 'y'}`)
  }
  if (data.categoriesWorked.length > 0) {
    lines.push(`- Active in: ${data.categoriesWorked.join(', ')}`)
  }
  if (data.streak > 0) {
    lines.push(`- Current streak: ${data.streak} days`)
  }
  return lines.join('\n')
}

// Chat conversations
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

// CLI logs
ipcMain.handle('get-cli-sessions', async () => {
  return getCliSessions()
})

ipcMain.handle('get-cli-session-messages', async (_, sessionId: string, offset?: number, limit?: number) => {
  return getCliSessionMessages(sessionId, offset, limit)
})

ipcMain.handle('search-cli-sessions', async (_, query: string) => {
  return searchCliSessions(query)
})

ipcMain.handle('search-github-repos', async (_, query: string) => {
  return searchGitHubRepos(query)
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
  const apiKey = getClaudeApiKey()
  if (!apiKey) throw new Error('Claude API key not configured')
  return brainstormTweet(apiKey, topic, history, persona || undefined)
})

ipcMain.handle('tweet-brainstorm-thread', async (_, topic: string, history: { role: string; content: string }[], persona?: any) => {
  const apiKey = getClaudeApiKey()
  if (!apiKey) throw new Error('Claude API key not configured')
  return brainstormThread(apiKey, topic, history, persona || undefined)
})

ipcMain.handle('tweet-refine', async (_, text: string, instruction: string, history: { role: string; content: string }[], persona?: any) => {
  const apiKey = getClaudeApiKey()
  if (!apiKey) throw new Error('Claude API key not configured')
  return refineTweet(apiKey, text, instruction, history, persona || undefined)
})

ipcMain.handle('tweet-analyze', async (_, text: string) => {
  const apiKey = getClaudeApiKey()
  if (!apiKey) throw new Error('Claude API key not configured')
  return analyzeTweet(apiKey, text)
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

// AI Tasks
ipcMain.handle('get-ai-tasks', () => {
  return getAITasks()
})

ipcMain.handle('create-ai-task', (_, task: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }) => {
  return createAITask(task)
})

ipcMain.handle('update-ai-task', (_, id: string, updates: any) => {
  return updateAITask(id, updates)
})

ipcMain.handle('delete-ai-task', (_, id: string) => {
  return deleteAITask(id)
})

ipcMain.handle('move-ai-task', (_, id: string, column: string) => {
  return moveAITask(id, column as any)
})

// Terminal
ipcMain.handle('create-terminal', (_, cols: number, rows: number) => {
  if (mainWindow) createTerminal(mainWindow, cols, rows)
})

ipcMain.handle('write-terminal', (_, data: string) => {
  writeTerminal(data)
})

ipcMain.handle('resize-terminal', (_, cols: number, rows: number) => {
  resizeTerminal(cols, rows)
})

ipcMain.handle('kill-terminal', () => {
  killTerminal()
})

// Clipboard
ipcMain.on('read-clipboard', (event) => {
  event.returnValue = clipboard.readText()
})

ipcMain.on('write-clipboard', (_, text: string) => {
  clipboard.writeText(text)
})

// Open URL in browser
ipcMain.handle('open-external', (_, url: string) => {
  return shell.openExternal(url)
})

// Window controls
ipcMain.on('close-window', () => {
  mainWindow?.hide()
})

ipcMain.on('minimize-window', () => {
  mainWindow?.hide()
})

app.whenReady().then(() => {
  initDatabase()
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
