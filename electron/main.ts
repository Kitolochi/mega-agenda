import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, Notification, clipboard, dialog, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, execSync } from 'child_process'
import { initDatabase, checkRecurringTasks, getCategories, getTasks, addTask, updateTask, deleteTask, toggleTaskComplete, getDailyNote, saveDailyNote, getRecentNotes, getStats, getTwitterSettings, saveTwitterSettings, getRSSFeeds, addRSSFeed, removeRSSFeed, getClaudeApiKey, saveClaudeApiKey, getActivityLog, getPomodoroState, startPomodoro, completePomodoro, startBreak, stopPomodoro, getMorningBriefing, saveMorningBriefing, dismissMorningBriefing, getBriefingData, getWeeklyReview, saveWeeklyReview, getAllWeeklyReviews, getWeeklyReviewData, checkWeeklyReviewNeeded, getChatConversations, getChatConversation, createChatConversation, addChatMessage, deleteChatConversation, renameChatConversation, getChatSettings, saveChatSettings, addCategory, deleteCategory, getTweetDrafts, getTweetDraft, createTweetDraft, updateTweetDraft, addTweetAIMessage, deleteTweetDraft, getTweetPersonas, createTweetPersona, deleteTweetPersona, getAITasks, createAITask, updateAITask, deleteAITask, moveAITask, getRoadmapGoals, createRoadmapGoal, updateRoadmapGoal, deleteRoadmapGoal, getMasterPlan, saveMasterPlan, clearMasterPlan, getMasterPlanTasks, createMasterPlanTask, updateMasterPlanTask, clearMasterPlanTasks, getMemories, getAllMemories, createMemory, updateMemory, deleteMemory, archiveMemory, pinMemory, getMemoryTopics, updateMemoryTopics, getMemorySettings, saveMemorySettings, isWelcomeDismissed, dismissWelcome } from './database'
import { verifyToken, getUserByUsername, getUserLists, fetchAllLists, postTweet, verifyOAuthCredentials } from './twitter'
import { fetchAllFeeds } from './rss'
import { summarizeAI, summarizeGeo, verifyClaudeKey, parseVoiceCommand, generateMorningBriefing, generateWeeklyReview } from './summarize'
import { brainstormTweet, brainstormThread, refineTweet, analyzeTweet } from './tweet-ai'
import { createTerminal, writeTerminal, resizeTerminal, killTerminal } from './terminal'
import { streamChatMessage, abortChatStream, getMemoryCountForChat } from './chat'
import { getCliSessions, getCliSessionMessages, searchCliSessions } from './cli-logs'
import { searchGitHubRepos } from './github'
import { extractMemoriesFromChat, extractMemoriesFromCli, extractMemoriesFromJournal, batchExtractMemories, extractMemoriesFromAgentResult } from './memory'
import { researchTopicSmart, generateActionPlan, generateTopics, generateMasterPlan, findClaudeCli, generateContextQuestions, extractTasksFromPlan, extractTasksFromActionPlan, saveMasterPlanFile } from './research'
import { findSessionByPromptFragment } from './cli-logs'
import { initEmbeddingModel, getEmbeddingStatus } from './embeddings'
import { initWhisperModel, transcribeAudio, getWhisperStatus } from './whisper'
import { loadVectorIndex, rebuildIndex, deleteIndex } from './vector-store'
import { streamSmartQuery } from './smart-query'
import { generateReorgPlan, previewReorgPlan, executeReorgPlan } from './reorganize'
import { getLLMSettings, saveLLMSettings } from './database'
import { verifyLLMKey, PROVIDER_MODELS, PROVIDER_CHAT_MODELS } from './llm'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Ensure mediaDevices API is available (requires secure context)
if (VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', VITE_DEV_SERVER_URL)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#0c0c0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show the window once the page is ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // No auto-hide on blur -- app shows in taskbar normally

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })
}

function createTray() {
  // Destroy previous tray if it exists (prevents duplicate tray icons on hot-reload)
  if (tray) {
    tray.destroy()
    tray = null
  }

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

  if (mainWindow.isMinimized()) mainWindow.restore()
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

// LLM Settings
ipcMain.handle('get-llm-settings', () => {
  return getLLMSettings()
})

ipcMain.handle('save-llm-settings', (_, updates: any) => {
  return saveLLMSettings(updates)
})

ipcMain.handle('verify-llm-key', async (_, provider: string, key: string) => {
  return verifyLLMKey(provider, key)
})

ipcMain.handle('get-provider-models', () => {
  return PROVIDER_MODELS
})

ipcMain.handle('get-provider-chat-models', () => {
  return PROVIDER_CHAT_MODELS
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

// Generate Topics for a Goal
ipcMain.handle('generate-topics', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find(g => g.id === goalId)
  if (!goal) throw new Error('Goal not found')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured. Set it in Settings.')

  const result = await generateTopics(goal, claudeApiKey)

  // Merge new topics with existing (no duplicates)
  const existingQ = new Set(goal.research_questions)
  const existingG = new Set(goal.guidance_needed)
  const newQuestions = result.research_questions.filter(q => !existingQ.has(q))
  const newGuidance = result.guidance_needed.filter(g => !existingG.has(g))

  updateRoadmapGoal(goalId, {
    research_questions: [...goal.research_questions, ...newQuestions],
    guidance_needed: [...goal.guidance_needed, ...newGuidance],
  } as any)

  return {
    added: { questions: newQuestions.length, guidance: newGuidance.length },
    total: { questions: goal.research_questions.length + newQuestions.length, guidance: goal.guidance_needed.length + newGuidance.length }
  }
})

// Research All Topics for a Goal (parallel batches, CLI first then API fallback)
ipcMain.handle('research-roadmap-goal', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find(g => g.id === goalId)
  if (!goal) throw new Error('Goal not found')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured. Set it in Settings.')

  const allTopics = [
    ...goal.research_questions.map((q, i) => ({ text: q, type: 'question' as const, index: i })),
    ...goal.guidance_needed.map((g, i) => ({ text: g, type: 'guidance' as const, index: i })),
  ]

  // Skip already-researched topics
  const toResearch = allTopics.filter(t =>
    !goal.topicReports?.some(r => r.topic === t.text && r.type === t.type)
  )

  if (toResearch.length === 0) return { researched: 0, total: allTopics.length }

  const usingCli = !!findClaudeCli()
  console.log(`Researching ${toResearch.length} topics for "${goal.title}" (${usingCli ? 'CLI + API fallback' : 'API only'})`)

  // Process in parallel batches of 3
  const batchSize = 3
  let researched = 0

  for (let i = 0; i < toResearch.length; i += batchSize) {
    const batch = toResearch.slice(i, i + batchSize)

    const results = await Promise.allSettled(
      batch.map(t => researchTopicSmart(goal, t.text, t.type, claudeApiKey))
    )

    // Re-read goal for latest state (avoids overwriting concurrent saves)
    const freshGoal = getRoadmapGoals().find(g => g.id === goalId)
    if (!freshGoal) break

    const topicReports = [...(freshGoal.topicReports || [])]
    const now = new Date().toISOString()

    results.forEach((result, j) => {
      if (result.status === 'fulfilled') {
        const topic = batch[j]
        const idx = topicReports.findIndex(r => r.topic === topic.text && r.type === topic.type)
        const report = { topic: topic.text, type: topic.type, report: result.value, generatedAt: now }
        if (idx >= 0) topicReports[idx] = report
        else topicReports.push(report)
        researched++
        console.log(`  [${researched}/${toResearch.length}] Completed: ${topic.text.slice(0, 60)}...`)
      } else {
        console.error(`  Failed: ${batch[j].text.slice(0, 60)}... - ${result.reason}`)
      }
    })

    updateRoadmapGoal(goalId, { topicReports } as any)
  }

  // Write goal context file with all accumulated research
  const finalGoal = getRoadmapGoals().find(g => g.id === goalId)
  if (finalGoal) writeGoalContextFile(finalGoal)

  return { researched, total: allTopics.length }
})

// Research Single Topic (CLI first, API fallback)
ipcMain.handle('research-roadmap-topic', async (_, goalId: string, topicIndex: number, topicType: 'question' | 'guidance') => {
  const goals = getRoadmapGoals()
  const goal = goals.find(g => g.id === goalId)
  if (!goal) throw new Error('Goal not found')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured. Set it in Settings.')

  const items = topicType === 'question' ? goal.research_questions : goal.guidance_needed
  if (topicIndex < 0 || topicIndex >= items.length) throw new Error('Topic index out of range')

  const topicText = items[topicIndex]
  const report = await researchTopicSmart(goal, topicText, topicType, claudeApiKey)

  // Save to goal's topicReports
  const generatedAt = new Date().toISOString()
  const topicReports = [...(goal.topicReports || [])]
  const existingIdx = topicReports.findIndex(r => r.topic === topicText && r.type === topicType)
  const newReport = { topic: topicText, type: topicType, report, generatedAt }
  if (existingIdx >= 0) topicReports[existingIdx] = newReport
  else topicReports.push(newReport)
  updateRoadmapGoal(goalId, { topicReports } as any)

  // Write goal context file with updated research
  const freshGoal = getRoadmapGoals().find(g => g.id === goalId)
  if (freshGoal) writeGoalContextFile(freshGoal)

  return { report, generatedAt }
})

// Generate Action Plan from existing research
ipcMain.handle('generate-action-plan', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find(g => g.id === goalId)
  if (!goal) throw new Error('Goal not found')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured. Set it in Settings.')

  const result = await generateActionPlan(goal, claudeApiKey)

  // Save as a special topic report with type 'action_plan'
  const generatedAt = new Date().toISOString()
  const topicReports = [...(goal.topicReports || [])]
  const existingIdx = topicReports.findIndex(r => (r as any).type === 'action_plan')
  const planReport = { topic: 'Action Plan', type: 'action_plan' as any, report: result.report, generatedAt }
  if (existingIdx >= 0) {
    topicReports[existingIdx] = planReport
  } else {
    topicReports.push(planReport)
  }
  updateRoadmapGoal(goalId, { topicReports } as any)

  // Write goal context file with action plan
  const freshGoal = getRoadmapGoals().find(g => g.id === goalId)
  if (freshGoal) writeGoalContextFile(freshGoal)

  return { report: result.report, generatedAt }
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

ipcMain.handle('get-memory-count-for-chat', (_, messages: { role: string; content: string }[]) => {
  return getMemoryCountForChat(messages)
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

// Roadmap Goals
ipcMain.handle('get-roadmap-goals', () => {
  return getRoadmapGoals()
})

ipcMain.handle('create-roadmap-goal', (_, goal: any) => {
  return createRoadmapGoal(goal)
})

ipcMain.handle('update-roadmap-goal', (_, id: string, updates: any) => {
  return updateRoadmapGoal(id, updates)
})

ipcMain.handle('delete-roadmap-goal', (_, id: string) => {
  return deleteRoadmapGoal(id)
})

// Master Plan
ipcMain.handle('get-master-plan', () => {
  return getMasterPlan()
})

ipcMain.handle('generate-master-plan', async () => {
  const goals = getRoadmapGoals()
  const goalsWithResearch = goals.filter(g => (g.topicReports || []).length > 0)
  if (goalsWithResearch.length === 0) throw new Error('No goals with research reports. Research at least one goal first.')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured. Set it in Settings.')

  const content = await generateMasterPlan(goalsWithResearch, claudeApiKey)

  const planDate = new Date().toISOString().split('T')[0]
  const plan = {
    content,
    generatedAt: new Date().toISOString(),
    goalIds: goalsWithResearch.map(g => g.id),
    metadata: {
      totalGoals: goals.length,
      goalsWithResearch: goalsWithResearch.length,
    }
  }
  const saved = saveMasterPlan(plan)

  // Save plan file to disk
  try { saveMasterPlanFile(content, planDate) } catch {}

  // Extract tasks from plan
  try {
    clearMasterPlanTasks(planDate)
    const extracted = await extractTasksFromPlan(content, goalsWithResearch, claudeApiKey)
    for (const t of extracted) {
      createMasterPlanTask({
        title: t.title,
        description: t.description,
        priority: t.priority,
        goalId: t.goalId,
        goalTitle: t.goalTitle,
        phase: t.phase,
        status: 'pending',
        planDate,
      })
    }
  } catch (err) {
    console.error('Failed to extract tasks from plan:', err)
  }

  return saved
})

ipcMain.handle('clear-master-plan', () => {
  return clearMasterPlan()
})

// Master Plan Execution
ipcMain.handle('generate-context-questions', async () => {
  const goals = getRoadmapGoals()
  const goalsWithResearch = goals.filter(g => (g.topicReports || []).length > 0)
  if (goalsWithResearch.length === 0) throw new Error('No goals with research reports.')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured.')

  return generateContextQuestions(goalsWithResearch, claudeApiKey)
})

ipcMain.handle('get-master-plan-tasks', (_, planDate?: string) => {
  return getMasterPlanTasks(planDate)
})

ipcMain.handle('update-master-plan-task', (_, id: string, updates: any) => {
  return updateMasterPlanTask(id, updates)
})

ipcMain.handle('launch-daily-plan', async (_, taskIds?: string[]) => {
  const allTasks = getMasterPlanTasks()
  const tolaunch = taskIds
    ? allTasks.filter(t => taskIds.includes(t.id) && t.status === 'pending')
    : allTasks.filter(t => t.status === 'pending').slice(0, 10)

  const launched: string[] = []
  const workingDir = process.env.USERPROFILE || '.'
  const env = { ...process.env }
  delete env.CLAUDECODE

  const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
  fs.mkdirSync(tmpDir, { recursive: true })

  for (const task of tolaunch.slice(0, 10)) {
    const safePrompt = `[Master Plan Task] ${task.title}: ${task.description}`.replace(/%/g, '%%').replace(/"/g, "'")
    const batFile = path.join(tmpDir, `plan-${task.id}-${Date.now()}.bat`)
    fs.writeFileSync(batFile, [
      '@echo off',
      `cd /d "${workingDir}"`,
      `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools "Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" -- "${safePrompt}"`,
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', 'start', `"${task.title.slice(0, 40)}"`, 'cmd', '/k', batFile], {
      detached: true,
      stdio: 'ignore',
      env,
    })
    child.unref()

    updateMasterPlanTask(task.id, { status: 'launched', launchedAt: new Date().toISOString() })
    launched.push(task.id)
  }

  return { launched: launched.length, taskIds: launched }
})

ipcMain.handle('poll-task-sessions', async () => {
  const tasks = getMasterPlanTasks()
  const needsMatch = tasks.filter(t => (t.status === 'launched' || t.status === 'running') && !t.sessionId)

  for (const task of needsMatch) {
    if (!task.launchedAt) continue
    const fragment = task.title.slice(0, 40)
    const sessionId = await findSessionByPromptFragment(fragment, task.launchedAt)
    if (sessionId) {
      updateMasterPlanTask(task.id, { sessionId, status: 'running' })
    }
  }

  return getMasterPlanTasks()
})

// Goal Action Plan Task Execution
ipcMain.handle('extract-goal-action-tasks', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find(g => g.id === goalId)
  if (!goal) throw new Error('Goal not found')

  const actionPlan = (goal.topicReports || []).find(r => (r as any).type === 'action_plan')
  if (!actionPlan) throw new Error('No action plan found. Generate one first with "Get Best Steps".')

  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured. Set it in Settings.')

  const planDate = `goal-${goalId}`
  clearMasterPlanTasks(planDate)

  const extracted = await extractTasksFromActionPlan(actionPlan.report, goal, claudeApiKey)
  const created = []
  for (const t of extracted) {
    created.push(createMasterPlanTask({
      title: t.title,
      description: t.description,
      priority: t.priority,
      goalId: t.goalId,
      goalTitle: t.goalTitle,
      phase: t.phase,
      status: 'pending',
      planDate,
      ...(t.taskType ? { taskType: t.taskType as any } : {}),
    }))
  }
  return created
})

// Agent config for task-type routing (Feature 2)
function getAgentConfig(taskType?: string): { preamble: string; allowedTools: string } {
  switch (taskType) {
    case 'research':
      return {
        preamble: 'You are a research specialist. Focus on gathering information, analyzing sources, and producing well-organized findings. Prioritize depth and accuracy.',
        allowedTools: '"Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" "Write(*)"',
      }
    case 'code':
      return {
        preamble: 'You are a software engineering specialist. Write clean, working code. Follow best practices, add appropriate error handling, and create production-ready implementations.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)"',
      }
    case 'writing':
      return {
        preamble: 'You are a writing specialist. Produce clear, well-structured content. Focus on readability, appropriate tone, and comprehensive coverage of the topic.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'planning':
      return {
        preamble: 'You are a strategic planning specialist. Create detailed, actionable plans with clear milestones, dependencies, and success criteria.',
        allowedTools: '"Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'communication':
      return {
        preamble: 'You are a communication specialist. Draft professional, clear communications. Consider the audience, tone, and key messages.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    default:
      return {
        preamble: 'You are a capable AI assistant. Complete the assigned task thoroughly and produce high-quality deliverables.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
  }
}

ipcMain.handle('launch-goal-tasks', async (_, goalId: string, taskIds?: string[]) => {
  const planDate = `goal-${goalId}`
  const allTasks = getMasterPlanTasks(planDate)
  const tolaunch = taskIds
    ? allTasks.filter(t => taskIds.includes(t.id) && t.status === 'pending')
    : allTasks.filter(t => t.status === 'pending').slice(0, 10)

  // Look up goal for workspace context
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  const goalSlug = goal ? slugify(goal.title) : `goal-${goalId}`
  const goalDir = path.join(getMemoryDir(), 'goals', goalSlug)
  const deliverablesDir = path.join(goalDir, 'deliverables')
  const workspaceFile = path.join(goalDir, '_workspace.md')

  // Create deliverables and agent-results directories
  fs.mkdirSync(deliverablesDir, { recursive: true })
  const agentResultsDir = path.join(goalDir, 'agent-results')
  fs.mkdirSync(agentResultsDir, { recursive: true })

  // Feature 1: Initialize git repo for the goal
  const repoDir = path.join(goalDir, 'repo')
  fs.mkdirSync(repoDir, { recursive: true })
  const gitDir = path.join(repoDir, '.git')
  if (!fs.existsSync(gitDir)) {
    try {
      execSync('git init', { cwd: repoDir, stdio: 'pipe' })
      execSync('git config user.email "mega-agenda@local"', { cwd: repoDir, stdio: 'pipe' })
      execSync('git config user.name "Mega Agenda"', { cwd: repoDir, stdio: 'pipe' })
      execSync(`git commit --allow-empty -m "init: ${(goal?.title || goalId).replace(/"/g, "'")}"`, { cwd: repoDir, stdio: 'pipe' })
    } catch (err) {
      console.error('Git init failed:', err)
    }
  }

  // Build workspace file (read-only context for agents)
  const actionPlan = goal ? (goal.topicReports || []).find((r: any) => r.type === 'action_plan') : null
  const actionPlanSummary = actionPlan ? actionPlan.report.slice(0, 2000) : '(No action plan available)'
  const taskTable = tolaunch.map((t, i) =>
    `| ${i + 1} | ${t.title} | ${t.priority} |`
  ).join('\n')

  const workspaceContent = [
    `# Workspace: ${goal?.title || goalId}`,
    goal?.description ? `> ${goal.description}` : '',
    '',
    `**Category:** ${goal?.category || 'N/A'} | **Priority:** ${goal?.priority || 'N/A'}`,
    '',
    '## Action Plan Summary',
    actionPlanSummary,
    '',
    '## Task Assignments',
    '| # | Task | Priority |',
    '|---|------|----------|',
    taskTable,
    '',
    '## Deliverables Directory',
    `Save files to: ${deliverablesDir}`,
    '',
    '## Agent Results Directory',
    `Each agent writes its own result file to: ${agentResultsDir}`,
    '',
  ].join('\n')

  fs.writeFileSync(workspaceFile, workspaceContent, 'utf-8')

  const launched: string[] = []
  const env = { ...process.env }
  delete env.CLAUDECODE

  const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
  fs.mkdirSync(tmpDir, { recursive: true })

  for (const task of tolaunch.slice(0, 10)) {
    const taskSlug = slugify(task.title).slice(0, 50)
    const agentResultFile = path.join(agentResultsDir, `${taskSlug}.md`)
    // Feature 2: Get agent config based on task type
    const agentConfig = getAgentConfig((task as any).taskType)
    const promptLines = [
      agentConfig.preamble,
      '',
      `[Goal Task: ${task.goalTitle}]`,
      '',
      `YOUR TASK: ${task.title}`,
      task.description,
      '',
      'BEFORE YOU START:',
      `1. Run "git log --oneline -10" to see what previous agents have already committed`,
      `2. Run "ls" or "dir" to see what files already exist in the repo`,
      '3. Read any existing files relevant to your task so you BUILD ON prior work, not duplicate it',
      '',
      'WORKSPACE COORDINATION:',
      `4. Read the shared workspace for context: ${workspaceFile}`,
      `5. Check other agents' results in: ${agentResultsDir}`,
      `6. Save files you create to: ${deliverablesDir}`,
      `7. When done, write your result summary to: ${agentResultFile}`,
      '   Use this format:',
      `   # Task: ${task.title}`,
      '   **Status:** completed',
      '   **Files created:** (list each file path)',
      '   **Summary:** (what you accomplished)',
      '8. Create real, usable files - code, templates, scripts, plans',
      '',
      'GIT WORKFLOW:',
      `Your working directory is a git repo at: ${repoDir}`,
      'Commit your work with a descriptive commit message when done.',
      `Use: git add -A && git commit -m "your message"`,
    ].join('\n')
    const safePrompt = promptLines.replace(/%/g, '%%').replace(/"/g, "'")
    const batFile = path.join(tmpDir, `goal-${task.id}-${Date.now()}.bat`)
    fs.writeFileSync(batFile, [
      '@echo off',
      `cd /d "${repoDir}"`,
      `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools ${agentConfig.allowedTools} -- "${safePrompt}"`,
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', 'start', '""', 'cmd', '/k', batFile], {
      detached: true,
      stdio: 'ignore',
      env,
    })
    child.unref()

    updateMasterPlanTask(task.id, { status: 'launched', launchedAt: new Date().toISOString() })
    launched.push(task.id)
  }

  return { launched: launched.length, taskIds: launched }
})

ipcMain.handle('poll-goal-task-sessions', async (_, goalId: string) => {
  const planDate = `goal-${goalId}`
  const tasks = getMasterPlanTasks(planDate)
  const needsMatch = tasks.filter(t => (t.status === 'launched' || t.status === 'running') && !t.sessionId)

  for (const task of needsMatch) {
    if (!task.launchedAt) continue
    const fragment = task.title.slice(0, 40)
    const sessionId = await findSessionByPromptFragment(fragment, task.launchedAt)
    if (sessionId) {
      updateMasterPlanTask(task.id, { sessionId, status: 'running' })
    }
  }

  // Feature 3: Auto-completion detection — check agent result files for completed status
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  if (goal) {
    const goalSlug = slugify(goal.title)
    const agentResultsDir = path.join(getMemoryDir(), 'goals', goalSlug, 'agent-results')
    const activeTasks = getMasterPlanTasks(planDate).filter(t => t.status === 'launched' || t.status === 'running')
    for (const task of activeTasks) {
      const taskSlug = slugify(task.title).slice(0, 50)
      const resultFile = path.join(agentResultsDir, `${taskSlug}.md`)
      try {
        if (fs.existsSync(resultFile)) {
          const content = fs.readFileSync(resultFile, 'utf-8')
          if (content.includes('**Status:** completed')) {
            updateMasterPlanTask(task.id, { status: 'completed', completedAt: new Date().toISOString() })
          }
        }
      } catch {}
    }
  }

  return getMasterPlanTasks(planDate)
})

// Feature 1: Git log for goal repo
ipcMain.handle('get-goal-git-log', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  if (!goal) return []
  const goalSlug = slugify(goal.title)
  const repoDir = path.join(getMemoryDir(), 'goals', goalSlug, 'repo')
  if (!fs.existsSync(path.join(repoDir, '.git'))) return []
  try {
    const log = execSync('git log --oneline -20 --format="%h|%s|%ai|%an"', { cwd: repoDir, encoding: 'utf-8' })
    return log.trim().split('\n').filter(Boolean).map(line => {
      const [hash, message, date, author] = line.split('|')
      return { hash, message, date, author }
    })
  } catch {
    return []
  }
})

ipcMain.handle('get-goal-repo-info', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  if (!goal) return null
  const goalSlug = slugify(goal.title)
  const repoDir = path.join(getMemoryDir(), 'goals', goalSlug, 'repo')
  if (!fs.existsSync(path.join(repoDir, '.git'))) return null
  try {
    // Count commits
    let commitCount = 0
    try {
      const countOut = execSync('git rev-list --count HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim()
      commitCount = parseInt(countOut, 10) || 0
    } catch {}
    // Count tracked files
    let fileCount = 0
    try {
      const filesOut = execSync('git ls-files', { cwd: repoDir, encoding: 'utf-8' }).trim()
      fileCount = filesOut ? filesOut.split('\n').length : 0
    } catch {}
    // Get repo size (rough)
    let sizeBytes = 0
    try {
      const entries = fs.readdirSync(repoDir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile()) {
          sizeBytes += fs.statSync(path.join(repoDir, e.name)).size
        }
      }
    } catch {}
    return { path: repoDir, commitCount, fileCount, sizeBytes }
  } catch {
    return null
  }
})

ipcMain.handle('get-goal-workspace', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  if (!goal) return null
  const goalSlug = slugify(goal.title)
  const goalDir = path.join(getMemoryDir(), 'goals', goalSlug)
  const workspaceFile = path.join(goalDir, '_workspace.md')
  try {
    let content = fs.readFileSync(workspaceFile, 'utf-8')
    // Merge per-agent result files into the workspace view
    const agentResultsDir = path.join(goalDir, 'agent-results')
    try {
      const resultFiles = fs.readdirSync(agentResultsDir).filter(f => f.endsWith('.md'))
      if (resultFiles.length > 0) {
        content += '\n## Agent Results\n\n'
        for (const rf of resultFiles) {
          content += fs.readFileSync(path.join(agentResultsDir, rf), 'utf-8') + '\n\n---\n\n'
        }
      }
    } catch {}
    return content
  } catch {
    return null
  }
})

ipcMain.handle('get-goal-deliverables', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  if (!goal) return []
  const goalSlug = slugify(goal.title)
  const deliverablesDir = path.join(getMemoryDir(), 'goals', goalSlug, 'deliverables')
  try {
    const entries = fs.readdirSync(deliverablesDir, { withFileTypes: true })
    return entries.filter(e => e.isFile()).map(e => {
      const stat = fs.statSync(path.join(deliverablesDir, e.name))
      return { name: e.name, size: stat.size, modifiedAt: stat.mtime.toISOString() }
    })
  } catch {
    return []
  }
})

// Feature 3: Extract learnings from goal agent results
ipcMain.handle('extract-goal-learnings', async (_, goalId: string) => {
  const goals = getRoadmapGoals()
  const goal = goals.find((g: any) => g.id === goalId)
  if (!goal) throw new Error('Goal not found')
  const goalSlug = slugify(goal.title)
  const goalDir = path.join(getMemoryDir(), 'goals', goalSlug)
  const agentResultsDir = path.join(goalDir, 'agent-results')

  // Read all agent result files
  let combinedContent = ''
  try {
    const resultFiles = fs.readdirSync(agentResultsDir).filter(f => f.endsWith('.md'))
    for (const rf of resultFiles) {
      combinedContent += fs.readFileSync(path.join(agentResultsDir, rf), 'utf-8') + '\n\n'
    }
  } catch {}

  // Read deliverables list
  const deliverablesDir = path.join(goalDir, 'deliverables')
  try {
    const delivFiles = fs.readdirSync(deliverablesDir)
    if (delivFiles.length > 0) {
      combinedContent += '\nDeliverables created: ' + delivFiles.join(', ') + '\n'
    }
  } catch {}

  if (!combinedContent.trim()) throw new Error('No agent results found to extract learnings from')

  const memories = await extractMemoriesFromAgentResult(
    combinedContent,
    goalId,
    goal.title,
    [goal.category, ...(goal.tags || [])]
  )

  // Write lessons-learned file (append)
  if (memories.length > 0) {
    const lessonsFile = path.join(goalDir, '_lessons-learned.md')
    const newEntries = memories.map(m =>
      `### ${m.title}\n${m.content}\n*Topics: ${m.topics.join(', ')}*\n`
    ).join('\n')
    const header = `\n## Learnings — ${new Date().toISOString().split('T')[0]}\n\n`
    const existing = fs.existsSync(lessonsFile) ? fs.readFileSync(lessonsFile, 'utf-8') : '# Lessons Learned\n'
    fs.writeFileSync(lessonsFile, existing + header + newEntries, 'utf-8')
  }

  return { memoriesCreated: memories.length, memories }
})

// Feature 4: Smart Query
ipcMain.handle('smart-query', async (_, query: string) => {
  if (!mainWindow) throw new Error('No main window')
  const queryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  streamSmartQuery(mainWindow, queryId, query)
  return { queryId }
})

// Welcome modal
ipcMain.handle('is-welcome-dismissed', () => isWelcomeDismissed())
ipcMain.handle('dismiss-welcome', () => { dismissWelcome() })

// RAG / Embeddings
ipcMain.handle('get-embedding-status', () => {
  return getEmbeddingStatus()
})

// Whisper (local voice transcription)
ipcMain.handle('get-whisper-status', () => {
  return getWhisperStatus()
})

ipcMain.handle('transcribe-audio', async (_, audioData: number[]) => {
  const float32 = new Float32Array(audioData)
  return transcribeAudio(float32)
})

ipcMain.handle('rebuild-vector-index', async () => {
  return rebuildIndex((info) => {
    mainWindow?.webContents.send('index-progress', info)
  })
})

ipcMain.handle('generate-reorg-plan', async () => {
  const claudeApiKey = getClaudeApiKey()
  if (!claudeApiKey) throw new Error('Claude API key not configured.')
  return generateReorgPlan(claudeApiKey)
})

ipcMain.handle('execute-reorg-plan', async (_, plan: any) => {
  const result = await executeReorgPlan(plan)
  // Re-index after reorganization
  try {
    deleteIndex()
    const embStatus = getEmbeddingStatus()
    if (embStatus.ready) {
      await rebuildIndex()
    }
  } catch (err) {
    console.error('Re-index after reorg failed:', err)
  }
  return result
})

// Context Files (read ~/.claude/memory/ recursively)
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.sh', '.bat', '.ps1', '.log', '.env', '.cfg', '.ini', '.conf'])

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function writeGoalContextFile(goal: any): void {
  try {
    const memoryDir = getMemoryDir()
    const goalSlug = slugify(goal.title)
    const goalDir = path.join(memoryDir, 'goals', goalSlug)
    if (!fs.existsSync(goalDir)) fs.mkdirSync(goalDir, { recursive: true })

    const now = new Date().toISOString()

    // Write _overview.md with goal metadata
    const overview: string[] = []
    overview.push(`# ${goal.title}`)
    overview.push('')
    if (goal.description) { overview.push(`> ${goal.description}`); overview.push('') }
    const meta: string[] = []
    if (goal.category) meta.push(`**Category:** ${goal.category}`)
    if (goal.priority) meta.push(`**Priority:** ${goal.priority}`)
    if (goal.status) meta.push(`**Status:** ${goal.status}`)
    if (goal.target_date) meta.push(`**Target Date:** ${goal.target_date}`)
    if (meta.length > 0) { overview.push(meta.join(' | ')); overview.push('') }
    if (goal.personal_context) {
      overview.push('## Personal Context')
      overview.push('')
      overview.push(goal.personal_context)
      overview.push('')
    }

    // List all topic files in the overview
    const reports = (goal.topicReports || []).filter((r: any) => r.type !== 'action_plan')
    if (reports.length > 0) {
      overview.push('## Research Topics')
      overview.push('')
      for (const r of reports) {
        overview.push(`- [${r.topic}](./${slugify(r.topic)}.md) *(${r.type})*`)
      }
      overview.push('')
    }

    const actionPlan = (goal.topicReports || []).find((r: any) => r.type === 'action_plan')
    if (actionPlan) {
      overview.push(`- [Action Plan](./_action-plan.md)`)
      overview.push('')
    }

    overview.push('---')
    overview.push(`*Last updated: ${now}*`)
    fs.writeFileSync(path.join(goalDir, '_overview.md'), overview.join('\n'), 'utf-8')

    // Write individual topic files
    for (const r of (goal.topicReports || [])) {
      const topicSlug = r.type === 'action_plan' ? '_action-plan' : slugify(r.topic)
      const topicLines: string[] = []
      topicLines.push(`# ${r.topic}`)
      topicLines.push('')
      topicLines.push(`**Goal:** ${goal.title} | **Type:** ${r.type} | **Generated:** ${r.generatedAt || 'unknown'}`)
      topicLines.push('')
      topicLines.push(r.report)
      topicLines.push('')
      topicLines.push('---')
      topicLines.push(`*Last updated: ${now}*`)
      fs.writeFileSync(path.join(goalDir, `${topicSlug}.md`), topicLines.join('\n'), 'utf-8')
    }

    // Write _context.md with placeholder prompts (only if it doesn't already exist)
    const contextFilePath = path.join(goalDir, '_context.md')
    if (!fs.existsSync(contextFilePath)) {
      const contextContent = `# Context: ${goal.title}

Fill in any of these to help the master plan generator personalize your plan.
Delete questions that aren't relevant.

## What have you already done toward this goal?

(your answer here)

## What is your current budget or resources?

(your answer here)

## Are there any blockers or constraints?

(your answer here)

## How urgent is this — what's driving the timeline?

(your answer here)

## Any other context?

(your answer here)
`
      fs.writeFileSync(contextFilePath, contextContent, 'utf-8')
    }
  } catch (err) {
    console.error(`Failed to write goal context files for "${goal.title}":`, err)
  }
}

function syncAllGoalContextFiles(): void {
  try {
    const goals = getRoadmapGoals()
    for (const goal of goals) {
      if ((goal.topicReports || []).length > 0) {
        writeGoalContextFile(goal)
      }
    }
    console.log(`Synced ${goals.filter(g => (g.topicReports || []).length > 0).length} goal context files`)
  } catch (err) {
    console.error('Failed to sync goal context files:', err)
  }
}

function scaffoldDomainFolders(): void {
  try {
    const memoryDir = getMemoryDir()
    const domainsDir = path.join(memoryDir, 'domains')

    const domains: Record<string, { label: string; profilePrompts: string[] }> = {
      career: {
        label: 'Career & Professional',
        profilePrompts: [
          'What is your current role/title and company?',
          'What industry do you work in?',
          'What are your key professional skills?',
          'What is your career stage (early, mid, senior, executive)?',
          'What does career success look like to you?',
        ],
      },
      health: {
        label: 'Health & Fitness',
        profilePrompts: [
          'What is your current fitness level (beginner, intermediate, advanced)?',
          'Do you have any health conditions or injuries to work around?',
          'What types of exercise do you enjoy?',
          'What are your dietary preferences or restrictions?',
          'How many hours of sleep do you typically get?',
        ],
      },
      financial: {
        label: 'Financial',
        profilePrompts: [
          'What is your current financial situation (stable, building, recovering)?',
          'Do you have a monthly budget or savings target?',
          'What are your biggest financial obligations?',
          'What is your risk tolerance for investments (conservative, moderate, aggressive)?',
          'Do you have an emergency fund?',
        ],
      },
      relationships: {
        label: 'Relationships & Social',
        profilePrompts: [
          'Who are the most important people in your life?',
          'What relationship areas need the most attention?',
          'How do you prefer to stay connected (calls, texts, in-person)?',
          'Are there relationships you want to strengthen or repair?',
          'How large is your social circle?',
        ],
      },
      learning: {
        label: 'Learning & Education',
        profilePrompts: [
          'What subjects or skills are you currently learning?',
          'What is your preferred learning style (reading, video, hands-on)?',
          'How much time per week can you dedicate to learning?',
          'Do you have any formal education goals (degrees, certifications)?',
          'What topics have you always wanted to explore?',
        ],
      },
      projects: {
        label: 'Projects & Building',
        profilePrompts: [
          'What active projects are you working on?',
          'What tools and technologies do you use most?',
          'Do you work solo or with a team?',
          'What is your project management style?',
          'What is the biggest project you have completed?',
        ],
      },
      personal: {
        label: 'Personal Development',
        profilePrompts: [
          'What personal habits are you trying to build or break?',
          'What are your core values?',
          'What does a great day look like for you?',
          'What areas of personal growth matter most right now?',
          'How do you handle stress and recharge?',
        ],
      },
      creative: {
        label: 'Creative & Hobbies',
        profilePrompts: [
          'What creative outlets do you enjoy (writing, music, art, etc.)?',
          'How much time do you spend on hobbies per week?',
          'Are there creative skills you want to develop?',
          'Do you share your creative work publicly?',
          'What inspires you creatively?',
        ],
      },
    }

    let created = 0
    let existed = 0

    for (const [slug, domain] of Object.entries(domains)) {
      const domainDir = path.join(domainsDir, slug)
      if (!fs.existsSync(domainDir)) fs.mkdirSync(domainDir, { recursive: true })

      const files: Record<string, string> = {
        'index.md': `# ${domain.label}\n\nThis folder contains structured context for your ${domain.label.toLowerCase()} goals.\nFiles here are automatically included when generating master plans.\n\n## Files\n- **profile.md** — Who you are in this domain\n- **goals.md** — What you want to achieve\n- **current_state.md** — Where you are right now\n- **history.md** — Key events, milestones, and decisions\n`,
        'profile.md': `# ${domain.label} — Profile\n\nFill in what is relevant. Delete questions that do not apply.\n\n${domain.profilePrompts.map(p => `## ${p}\n\n(your answer here)\n`).join('\n')}\n---\n*Last updated: (auto-filled on edit)*\n`,
        'goals.md': `# ${domain.label} — Goals\n\nList your current goals in this area. Be specific about outcomes and timelines.\n\n## Active Goals\n\n- \n\n## Completed Goals\n\n- \n\n## Someday / Maybe\n\n- \n`,
        'current_state.md': `# ${domain.label} — Current State\n\nCapture a snapshot of where you are right now. Update this periodically.\n\n## Status\n\n(describe your current situation)\n\n## Recent Progress\n\n- \n\n## Blockers or Challenges\n\n- \n\n## Next Actions\n\n- \n`,
        'history.md': `# ${domain.label} — History\n\nRecord key milestones, decisions, and turning points.\n\n## Timeline\n\n- **${new Date().toISOString().split('T')[0]}** — Domain folder created\n`,
      }

      for (const [fileName, content] of Object.entries(files)) {
        const filePath = path.join(domainDir, fileName)
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, content, 'utf-8')
          created++
        } else {
          existed++
        }
      }
    }

    console.log(`Domain folders scaffolded: ${created} files created, ${existed} already existed`)
  } catch (err) {
    console.error('Failed to scaffold domain folders:', err)
  }
}

function scanDirectory(dir: string, memoryRoot: string): any[] {
  const results: any[] = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(memoryRoot, dir).replace(/\\/g, '/')
    const folder = relativePath === '.' ? '' : relativePath
    const stat = fs.statSync(fullPath)
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: fullPath,
        content: '',
        modifiedAt: stat.mtime.toISOString(),
        folder,
        isDirectory: true,
        size: 0
      })
      results.push(...scanDirectory(fullPath, memoryRoot))
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      const isText = TEXT_EXTENSIONS.has(ext)
      let content = ''
      if (isText) {
        try { content = fs.readFileSync(fullPath, 'utf-8') } catch { content = '' }
      }
      results.push({
        name: entry.name,
        path: fullPath,
        content,
        modifiedAt: stat.mtime.toISOString(),
        folder,
        isDirectory: false,
        size: stat.size
      })
    }
  }
  return results
}

ipcMain.handle('get-context-files', () => {
  const memoryDir = getMemoryDir()
  try {
    if (!fs.existsSync(memoryDir)) return []
    return scanDirectory(memoryDir, memoryDir)
  } catch {
    return []
  }
})

ipcMain.handle('save-context-file', (_, name: string, content: string, folder: string = '') => {
  const memoryDir = getMemoryDir()
  try {
    const targetDir = folder ? path.join(memoryDir, folder) : memoryDir
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    const filePath = path.join(targetDir, name)
    fs.writeFileSync(filePath, content, 'utf-8')
    const stat = fs.statSync(filePath)
    return { name, path: filePath, content, modifiedAt: stat.mtime.toISOString(), folder, isDirectory: false, size: stat.size }
  } catch (err: any) {
    throw new Error('Failed to save context file: ' + (err.message || err))
  }
})

ipcMain.handle('delete-context-file', (_, relativePath: string) => {
  const memoryDir = getMemoryDir()
  try {
    const filePath = path.join(memoryDir, relativePath)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('create-context-folder', (_, relativePath: string) => {
  const memoryDir = getMemoryDir()
  try {
    const folderPath = path.join(memoryDir, relativePath)
    fs.mkdirSync(folderPath, { recursive: true })
    return true
  } catch {
    return false
  }
})

ipcMain.handle('delete-context-folder', (_, relativePath: string) => {
  const memoryDir = getMemoryDir()
  try {
    const folderPath = path.join(memoryDir, relativePath)
    if (!fs.existsSync(folderPath)) return false
    const contents = fs.readdirSync(folderPath)
    if (contents.length > 0) return false // only delete empty folders
    fs.rmdirSync(folderPath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('upload-context-files', async (_, targetFolder: string) => {
  const memoryDir = getMemoryDir()
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: 'Upload files to context'
  })
  if (result.canceled || result.filePaths.length === 0) return []
  const uploaded: any[] = []
  const destDir = targetFolder ? path.join(memoryDir, targetFolder) : memoryDir
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  for (const srcPath of result.filePaths) {
    const fileName = path.basename(srcPath)
    const destPath = path.join(destDir, fileName)
    fs.copyFileSync(srcPath, destPath)
    const stat = fs.statSync(destPath)
    const ext = path.extname(fileName).toLowerCase()
    const isText = TEXT_EXTENSIONS.has(ext)
    let content = ''
    if (isText) {
      try { content = fs.readFileSync(destPath, 'utf-8') } catch { content = '' }
    }
    uploaded.push({
      name: fileName,
      path: destPath,
      content,
      modifiedAt: stat.mtime.toISOString(),
      folder: targetFolder,
      isDirectory: false,
      size: stat.size
    })
  }
  return uploaded
})

// Domain Folders
ipcMain.handle('scaffold-domain-folders', () => {
  scaffoldDomainFolders()
  return true
})

// Memory
ipcMain.handle('get-memories', () => {
  return getMemories()
})

ipcMain.handle('create-memory', (_, memory: any) => {
  return createMemory(memory)
})

ipcMain.handle('update-memory', (_, id: string, updates: any) => {
  return updateMemory(id, updates)
})

ipcMain.handle('delete-memory', (_, id: string) => {
  return deleteMemory(id)
})

ipcMain.handle('archive-memory', (_, id: string) => {
  return archiveMemory(id)
})

ipcMain.handle('pin-memory', (_, id: string) => {
  return pinMemory(id)
})

ipcMain.handle('get-memory-topics', () => {
  return getMemoryTopics()
})

ipcMain.handle('update-memory-topics', (_, topics: any[]) => {
  return updateMemoryTopics(topics)
})

ipcMain.handle('get-memory-settings', () => {
  return getMemorySettings()
})

ipcMain.handle('save-memory-settings', (_, settings: any) => {
  return saveMemorySettings(settings)
})

ipcMain.handle('extract-memories-from-chat', async (_, conversationId: string) => {
  return extractMemoriesFromChat(conversationId)
})

ipcMain.handle('extract-memories-from-cli', async (_, sessionId: string) => {
  return extractMemoriesFromCli(sessionId)
})

ipcMain.handle('extract-memories-from-journal', async (_, date: string) => {
  return extractMemoriesFromJournal(date)
})

ipcMain.handle('batch-extract-memories', async () => {
  return batchExtractMemories()
})

// Launch external terminal
ipcMain.handle('launch-external-terminal', async (_, prompt: string, cwd?: string) => {
  const workingDir = cwd || process.env.USERPROFILE || '.'
  const env = { ...process.env }
  delete env.CLAUDECODE
  // Write prompt directly into a temp batch file to avoid all cmd.exe quoting/escaping issues
  const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
  fs.mkdirSync(tmpDir, { recursive: true })
  const batFile = path.join(tmpDir, `launch-${Date.now()}.bat`)
  // Escape for batch: % -> %%, " -> ' (prompt already has " -> ' from renderer, but double-check)
  const safePrompt = prompt.replace(/%/g, '%%').replace(/"/g, "'")
  fs.writeFileSync(batFile, [
    '@echo off',
    `cd /d "${workingDir}"`,
    `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools "Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" -- "${safePrompt}"`,
  ].join('\r\n'))
  const child = spawn('cmd.exe', ['/c', 'start', '""', 'cmd', '/k', batFile], {
    detached: true,
    stdio: 'ignore',
    env,
  })
  child.unref()
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
  mainWindow?.minimize()
})

// Enforce single instance — quit if another is already running
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.center()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // Auto-grant microphone permission for voice commands
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'clipboard-read', 'notifications'].includes(permission))
  })

  initDatabase()
  createWindow()
  createTray()

  // Check recurring tasks every 60s; notify renderer to re-fetch if any were reset
  setInterval(() => {
    if (checkRecurringTasks()) {
      mainWindow?.webContents.send('tasks-updated')
    }
  }, 60 * 1000)

  // Sync goal context files on startup
  syncAllGoalContextFiles()

  // Scaffold domain-based memory folders
  scaffoldDomainFolders()

  // Background: pre-warm embedding + whisper models after 5s, then refresh vector index
  setTimeout(async () => {
    try {
      // Load embedding and whisper models in parallel
      const embeddingReady = initEmbeddingModel((progress) => {
        mainWindow?.webContents.send('embedding-progress', progress)
      })
      initWhisperModel().catch(err => {
        console.error('Whisper model init failed:', err)
      })
      await embeddingReady
      // Load or build vector index once model is ready
      const embStatus = getEmbeddingStatus()
      if (embStatus.ready) {
        const existing = loadVectorIndex()
        // Always do an incremental refresh to pick up changes
        await rebuildIndex((info) => {
          mainWindow?.webContents.send('index-progress', info)
        })
      }
    } catch (err) {
      console.error('Background embedding/index init failed:', err)
    }
  }, 5000)

  // Check once per hour if a new day has started; if so, re-sync goal context files
  let lastSyncDate = new Date().toISOString().split('T')[0]
  setInterval(() => {
    const today = new Date().toISOString().split('T')[0]
    if (today !== lastSyncDate) {
      lastSyncDate = today
      console.log('New day detected — syncing goal context files')
      syncAllGoalContextFiles()
    }
  }, 60 * 60 * 1000)
})

app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
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
