import path from 'path'
import fs from 'fs'
import { app } from 'electron'

interface Task {
  id: number
  category_id: number
  title: string
  description?: string
  priority: number
  due_date?: string
  completed: number
  created_at: string
  updated_at?: string
  // Recurring fields
  is_recurring: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number // e.g., every 2 days, every 3 weeks
  last_completed?: string
}

interface Category {
  id: number
  name: string
  color: string
  icon: string
  sort_order: number
}

interface DailyNote {
  date: string
  content: string
  updated_at: string
}

interface Stats {
  currentStreak: number
  bestStreak: number
  lastStreakDate: string
  tasksCompletedThisWeek: number
  weekStartDate: string
}

interface TwitterSettings {
  bearerToken: string
  username: string
  userId: string
  listIds: { id: string; name: string }[]
  // OAuth 1.0a credentials for posting tweets
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
}

interface RSSFeed {
  url: string
  name: string
  category: string
}

interface ActivityEntry {
  date: string
  tasksCompleted: number
  focusMinutes: number
  categoriesWorked: string[]
}

interface PomodoroSession {
  taskId: number | null
  taskTitle: string
  startedAt: string
  durationMinutes: number
  type: 'work' | 'short_break' | 'long_break'
}

interface PomodoroState {
  isRunning: boolean
  currentSession: PomodoroSession | null
  sessionsCompleted: number
  totalSessionsToday: number
  todayDate: string
}

interface MorningBriefing {
  date: string
  content: string
  isAiEnhanced: boolean
  dismissed: boolean
  generatedAt: string
}

interface WeeklyReview {
  weekStartDate: string
  content: string
  generatedAt: string
  tasksCompletedCount: number
  categoriesWorked: string[]
  streakAtGeneration: number
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  tokenUsage?: { input: number; output: number }
}

interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  systemPrompt?: string
}

interface ChatSettings {
  model: string
  systemPromptMode: 'default' | 'context' | 'custom'
  maxTokens: number
  customSystemPrompt?: string
}

interface TweetAIMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'brainstorm' | 'refine' | 'analyze' | 'freeform'
  content: string
  timestamp: string
}

interface TweetDraft {
  id: string
  text: string
  segments: string[]
  isThread: boolean
  status: 'draft' | 'refining' | 'ready' | 'posted'
  topic?: string
  aiHistory: TweetAIMessage[]
  createdAt: string
  updatedAt: string
  postedAt?: string
  tweetId?: string
  threadTweetIds: string[]
}

interface TweetPersona {
  id: string
  name: string
  description: string
  exampleTweets: string[]
  isBuiltIn: boolean
  createdAt: string
}

interface AITask {
  id: string
  title: string
  description: string
  column: 'backlog' | 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface RoadmapSubGoal {
  id: string
  title: string
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold'
  notes?: string
}

interface TopicReport {
  topic: string
  type: 'question' | 'guidance'
  report: string
  generatedAt: string
}

interface RoadmapGoal {
  id: string
  title: string
  description: string
  category: 'career' | 'health' | 'financial' | 'relationships' | 'learning' | 'projects' | 'personal' | 'creative'
  targetQuarter: 1 | 2 | 3 | 4
  targetYear: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold'
  research_questions: string[]
  guidance_needed: string[]
  notes: string
  sub_goals: RoadmapSubGoal[]
  tags: string[]
  topicReports: TopicReport[]
  personalContext?: string
  contextFiles?: string[]
  createdAt: string
  updatedAt: string
}

interface MasterPlanTask {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  goalId: string
  goalTitle: string
  phase: string
  status: 'pending' | 'launched' | 'running' | 'completed' | 'failed'
  launchedAt?: string
  completedAt?: string
  sessionId?: string
  taskType?: 'research' | 'code' | 'writing' | 'planning' | 'communication'
  createdAt: string
  planDate: string
}

interface Memory {
  id: string
  title: string
  content: string
  topics: string[]
  sourceType: 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual'
  sourceId: string | null
  sourcePreview: string
  importance: 1 | 2 | 3
  createdAt: string
  updatedAt: string
  isPinned: boolean
  isArchived: boolean
  relatedMemoryIds: string[]
}

interface MemoryTopic {
  name: string
  color: string
  memoryCount: number
}

interface MemorySettings {
  autoGenerate: boolean
  maxMemoriesInContext: number
  tokenBudget: number
}

interface Database {
  categories: Category[]
  tasks: Task[]
  dailyNotes: DailyNote[]
  nextTaskId: number
  stats: Stats
  twitter: TwitterSettings
  rssFeeds: RSSFeed[]
  claudeApiKey: string
  tavilyApiKey: string
  activityLog: ActivityEntry[]
  pomodoroState: PomodoroState
  morningBriefings: MorningBriefing[]
  weeklyReviews: WeeklyReview[]
  chatConversations: ChatConversation[]
  chatSettings: ChatSettings
  tweetDrafts: TweetDraft[]
  tweetPersonas: TweetPersona[]
  aiTasks: AITask[]
  roadmapGoals: RoadmapGoal[]
  masterPlan: { content: string; generatedAt: string; goalIds: string[]; metadata: { totalGoals: number; goalsWithResearch: number } } | null
  masterPlanTasks: MasterPlanTask[]
  memories: Memory[]
  memoryTopics: MemoryTopic[]
  memorySettings: MemorySettings
  welcomeDismissed: boolean
}

let db: Database
let dbPath: string

function getWeekStart(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

function checkWeeklyReset() {
  const currentWeekStart = getWeekStart()
  if (db.stats.weekStartDate !== currentWeekStart) {
    db.stats.tasksCompletedThisWeek = 0
    db.stats.weekStartDate = currentWeekStart
    saveDatabase()
  }
}

const defaultCategories: Category[] = [
  { id: 1, name: 'Work', color: '#3b82f6', icon: '💼', sort_order: 1 },
  { id: 2, name: 'Relationships', color: '#ec4899', icon: '💕', sort_order: 2 },
  { id: 3, name: 'House', color: '#22c55e', icon: '🏠', sort_order: 3 },
  { id: 4, name: 'Goals', color: '#8b5cf6', icon: '🎯', sort_order: 4 },
  { id: 5, name: 'Health', color: '#f97316', icon: '💪', sort_order: 5 },
  { id: 6, name: 'Financials', color: '#eab308', icon: '💰', sort_order: 6 },
  { id: 7, name: 'Daily', color: '#14b8a6', icon: '📋', sort_order: 7 },
]

export function initDatabase(): Database {
  dbPath = path.join(app.getPath('userData'), 'mega-agenda.json')

  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, 'utf-8')
    db = JSON.parse(data)
    if (!db.dailyNotes) {
      db.dailyNotes = []
    }
    // Migrate old tasks to have recurring fields
    db.tasks = db.tasks.map(t => ({
      ...t,
      is_recurring: t.is_recurring || false
    }))
    if (!db.categories.find(c => c.id === 7)) {
      db.categories.push({ id: 7, name: 'Daily', color: '#14b8a6', icon: '📋', sort_order: 7 })
    }
    saveDatabase()
  } else {
    db = {
      categories: defaultCategories,
      tasks: [],
      dailyNotes: [],
      nextTaskId: 1,
      stats: {
        currentStreak: 0,
        bestStreak: 0,
        lastStreakDate: '',
        tasksCompletedThisWeek: 0,
        weekStartDate: getWeekStart()
      },
      twitter: { bearerToken: '', username: '', userId: '', listIds: [], apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' },
      rssFeeds: [],
      claudeApiKey: '',
      tavilyApiKey: '',
      activityLog: [],
      pomodoroState: {
        isRunning: false,
        currentSession: null,
        sessionsCompleted: 0,
        totalSessionsToday: 0,
        todayDate: new Date().toISOString().split('T')[0]
      },
      morningBriefings: [],
      weeklyReviews: [],
      chatConversations: [],
      chatSettings: {
        model: 'claude-sonnet-4-5-20250929',
        systemPromptMode: 'default',
        maxTokens: 4096
      },
      tweetDrafts: [],
      tweetPersonas: [],
      aiTasks: [],
      roadmapGoals: []
    }
    saveDatabase()
  }

  // Initialize twitter settings if missing
  if (!db.twitter) {
    db.twitter = { bearerToken: '', username: '', userId: '', listIds: [], apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' }
    saveDatabase()
  }

  // Migrate: add OAuth fields if missing
  if (db.twitter.apiKey === undefined) {
    db.twitter.apiKey = ''
    db.twitter.apiSecret = ''
    db.twitter.accessToken = ''
    db.twitter.accessTokenSecret = ''
    saveDatabase()
  }

  // Initialize rssFeeds if missing
  if (!db.rssFeeds) {
    db.rssFeeds = []
    saveDatabase()
  }

  // Migrate feeds without category
  if (db.rssFeeds.length > 0 && !(db.rssFeeds[0] as any).category) {
    db.rssFeeds = db.rssFeeds.map(f => ({ ...f, category: (f as any).category || 'ai' }))
    saveDatabase()
  }

  // Initialize claudeApiKey if missing
  if (db.claudeApiKey === undefined) {
    db.claudeApiKey = ''
    saveDatabase()
  }

  // Initialize tavilyApiKey if missing
  if ((db as any).tavilyApiKey === undefined) {
    db.tavilyApiKey = ''
    saveDatabase()
  }

  // Initialize activityLog if missing
  if (!db.activityLog) {
    db.activityLog = []
    saveDatabase()
  }

  // Initialize pomodoroState if missing
  if (!db.pomodoroState) {
    db.pomodoroState = {
      isRunning: false,
      currentSession: null,
      sessionsCompleted: 0,
      totalSessionsToday: 0,
      todayDate: new Date().toISOString().split('T')[0]
    }
    saveDatabase()
  }

  // Initialize morningBriefings if missing
  if (!db.morningBriefings) {
    db.morningBriefings = []
    saveDatabase()
  }

  // Initialize weeklyReviews if missing
  if (!db.weeklyReviews) {
    db.weeklyReviews = []
    saveDatabase()
  }

  // Initialize chatConversations if missing
  if (!db.chatConversations) {
    db.chatConversations = []
    saveDatabase()
  }

  // Initialize chatSettings if missing
  if (!db.chatSettings) {
    db.chatSettings = {
      model: 'claude-sonnet-4-5-20250929',
      systemPromptMode: 'default',
      maxTokens: 4096
    }
    saveDatabase()
  }

  // Initialize tweetDrafts if missing
  if (!db.tweetDrafts) {
    db.tweetDrafts = []
    saveDatabase()
  }

  // Migrate tweetDrafts: add thread fields if missing
  let draftsNeedMigration = false
  db.tweetDrafts = db.tweetDrafts.map(d => {
    if (d.segments === undefined) {
      draftsNeedMigration = true
      return { ...d, segments: d.text ? [d.text] : [''], isThread: false, threadTweetIds: [] }
    }
    return d
  })
  if (draftsNeedMigration) saveDatabase()

  // Initialize tweetPersonas if missing
  if (!db.tweetPersonas) {
    db.tweetPersonas = []
    saveDatabase()
  }

  // Initialize aiTasks if missing
  if (!db.aiTasks) {
    db.aiTasks = []
    saveDatabase()
  }

  // Initialize roadmapGoals if missing
  if (!db.roadmapGoals) {
    db.roadmapGoals = []
    saveDatabase()
  }

  // Initialize masterPlan if missing
  if ((db as any).masterPlan === undefined) {
    db.masterPlan = null
    saveDatabase()
  }

  // Migrate roadmapGoals: add topicReports if missing
  let goalsNeedMigration = false
  db.roadmapGoals = db.roadmapGoals.map(g => {
    if ((g as any).topicReports === undefined) {
      goalsNeedMigration = true
      return { ...g, topicReports: [] }
    }
    return g
  })
  if (goalsNeedMigration) saveDatabase()

  // Migrate roadmapGoals: add contextFiles if missing
  let goalsNeedContextFilesMigration = false
  db.roadmapGoals = db.roadmapGoals.map(g => {
    if ((g as any).contextFiles === undefined) {
      goalsNeedContextFilesMigration = true
      return { ...g, contextFiles: [] }
    }
    return g
  })
  if (goalsNeedContextFilesMigration) saveDatabase()

  // Initialize masterPlanTasks if missing
  if (!(db as any).masterPlanTasks) {
    db.masterPlanTasks = []
    saveDatabase()
  }

  // Initialize memories if missing
  if (!db.memories) {
    db.memories = []
    saveDatabase()
  }

  // Initialize memoryTopics if missing
  if (!db.memoryTopics) {
    db.memoryTopics = []
    saveDatabase()
  }

  // Initialize memorySettings if missing
  if (!db.memorySettings) {
    db.memorySettings = { autoGenerate: false, maxMemoriesInContext: 5, tokenBudget: 800 }
    saveDatabase()
  }

  // Initialize stats if missing
  if (!db.stats) {
    db.stats = {
      currentStreak: 0,
      bestStreak: 0,
      lastStreakDate: '',
      tasksCompletedThisWeek: 0,
      weekStartDate: getWeekStart()
    }
    saveDatabase()
  }

  // Initialize welcomeDismissed if missing
  if ((db as any).welcomeDismissed === undefined) {
    db.welcomeDismissed = false
    saveDatabase()
  }

  // Reset weekly stats if new week
  checkWeeklyReset()

  // Check and reset recurring tasks on startup
  checkRecurringTasks()

  return db
}

function saveDatabase() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8')
}

/** Get the current date string in EST/EDT (America/New_York) */
function getESTDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // 'en-CA' gives YYYY-MM-DD
}

/** Get EST date parts for month-based comparisons */
function getESTParts(date: Date = new Date()): { year: number; month: number; day: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const year = parseInt(parts.find(p => p.type === 'year')!.value)
  const month = parseInt(parts.find(p => p.type === 'month')!.value)
  const day = parts.map(p => p.value).join('')
  return { year, month, day }
}

/** Count calendar days between two dates in EST */
function estDaysBetween(a: Date, b: Date): number {
  const dateA = getESTDate(a)
  const dateB = getESTDate(b)
  const msA = new Date(dateA + 'T00:00:00').getTime()
  const msB = new Date(dateB + 'T00:00:00').getTime()
  return Math.floor((msB - msA) / (1000 * 60 * 60 * 24))
}

function checkRecurringTasks() {
  let changed = false
  const now = new Date()
  const todayEST = getESTDate(now)

  db.tasks.forEach(task => {
    // Daily category tasks always reset at the start of each EST day
    if (task.category_id === DAILY_CATEGORY_ID && task.completed) {
      const completedAt = task.last_completed || task.updated_at || task.created_at
      const completedDateEST = getESTDate(new Date(completedAt))
      if (completedDateEST !== todayEST) {
        task.completed = 0
        task.updated_at = now.toISOString()
        changed = true
      }
      return
    }

    // Other recurring tasks use interval-based logic
    if (task.is_recurring && task.completed && task.last_completed) {
      const lastCompleted = new Date(task.last_completed)
      let shouldReset = false

      if (task.recurrence_type === 'daily') {
        const interval = task.recurrence_interval || 1
        shouldReset = estDaysBetween(lastCompleted, now) >= interval
      } else if (task.recurrence_type === 'weekly') {
        const interval = task.recurrence_interval || 1
        shouldReset = estDaysBetween(lastCompleted, now) >= (interval * 7)
      } else if (task.recurrence_type === 'monthly') {
        const interval = task.recurrence_interval || 1
        const lastParts = getESTParts(lastCompleted)
        const nowParts = getESTParts(now)
        const monthsDiff = (nowParts.year - lastParts.year) * 12 + (nowParts.month - lastParts.month)
        shouldReset = monthsDiff >= interval
      }

      if (shouldReset) {
        task.completed = 0
        task.updated_at = now.toISOString()
        changed = true
      }
    }
  })

  if (changed) saveDatabase()
  return changed
}

export { checkRecurringTasks }

export function getCategories(): Category[] {
  return db.categories.sort((a, b) => a.sort_order - b.sort_order)
}

export function addCategory(name: string, color: string, icon: string): Category {
  const maxId = Math.max(...db.categories.map(c => c.id), 0)
  const maxSort = Math.max(...db.categories.map(c => c.sort_order), 0)
  const cat: Category = { id: maxId + 1, name, color, icon, sort_order: maxSort + 1 }
  db.categories.push(cat)
  saveDatabase()
  return cat
}

const DAILY_CATEGORY_ID = 7

export function deleteCategory(id: number): void {
  // Never delete the locked Daily category
  if (id === DAILY_CATEGORY_ID) return
  // Don't delete if tasks exist in this category
  const hasTasks = db.tasks.some(t => t.category_id === id)
  if (hasTasks) return
  db.categories = db.categories.filter(c => c.id !== id)
  saveDatabase()
}

export function getTasks(categoryId?: number): Task[] {
  let tasks = db.tasks
  if (categoryId) {
    tasks = tasks.filter(t => t.category_id === categoryId)
  }
  return tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed - b.completed
    if (a.priority !== b.priority) return a.priority - b.priority
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function addTask(task: {
  category_id: number
  title: string
  description?: string
  priority?: number
  due_date?: string
  is_recurring?: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number
}): Task {
  const newTask: Task = {
    id: db.nextTaskId++,
    category_id: task.category_id,
    title: task.title,
    description: task.description,
    priority: task.priority || 2,
    due_date: task.due_date,
    completed: 0,
    created_at: new Date().toISOString(),
    is_recurring: task.is_recurring || false,
    recurrence_type: task.recurrence_type,
    recurrence_interval: task.recurrence_interval || 1
  }

  db.tasks.push(newTask)
  saveDatabase()
  return newTask
}

export function updateTask(id: number, updates: {
  title?: string
  description?: string
  priority?: number
  due_date?: string
  completed?: number
  category_id?: number
  is_recurring?: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number
}): Task | null {
  const taskIndex = db.tasks.findIndex(t => t.id === id)
  if (taskIndex === -1) return null

  const task = db.tasks[taskIndex]

  if (updates.title !== undefined) task.title = updates.title
  if (updates.description !== undefined) task.description = updates.description
  if (updates.priority !== undefined) task.priority = updates.priority
  if (updates.due_date !== undefined) task.due_date = updates.due_date
  if (updates.completed !== undefined) task.completed = updates.completed
  if (updates.category_id !== undefined) task.category_id = updates.category_id
  if (updates.is_recurring !== undefined) task.is_recurring = updates.is_recurring
  if (updates.recurrence_type !== undefined) task.recurrence_type = updates.recurrence_type
  if (updates.recurrence_interval !== undefined) task.recurrence_interval = updates.recurrence_interval

  task.updated_at = new Date().toISOString()

  saveDatabase()
  return task
}

export function deleteTask(id: number): { success: boolean } {
  const taskIndex = db.tasks.findIndex(t => t.id === id)
  if (taskIndex === -1) return { success: false }

  db.tasks.splice(taskIndex, 1)
  saveDatabase()
  return { success: true }
}

export function toggleTaskComplete(id: number): Task | null {
  const task = db.tasks.find(t => t.id === id)
  if (!task) return null

  const wasCompleted = task.completed === 1

  if (task.completed === 0) {
    // Marking as complete
    task.completed = 1
    if (task.is_recurring || task.category_id === DAILY_CATEGORY_ID) {
      task.last_completed = new Date().toISOString()
    }
    // Update weekly stats
    db.stats.tasksCompletedThisWeek++

    // Log activity
    const category = db.categories.find(c => c.id === task.category_id)
    logActivity('task_complete', { categoryName: category?.name || 'Unknown' })

    // Check streak - if all high priority tasks are done today
    updateStreak()
  } else {
    // Marking as incomplete
    task.completed = 0
    if (wasCompleted) {
      db.stats.tasksCompletedThisWeek = Math.max(0, db.stats.tasksCompletedThisWeek - 1)
    }
    logActivity('task_uncomplete', {})
  }

  task.updated_at = new Date().toISOString()

  saveDatabase()
  return task
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0]
  const highPriorityTasks = db.tasks.filter(t => t.priority === 1)
  const allHighDone = highPriorityTasks.length > 0 && highPriorityTasks.every(t => t.completed)

  if (allHighDone) {
    if (db.stats.lastStreakDate !== today) {
      // Check if yesterday was the last streak day (continuing streak)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (db.stats.lastStreakDate === yesterdayStr || db.stats.lastStreakDate === '') {
        db.stats.currentStreak++
      } else {
        // Streak broken, start new
        db.stats.currentStreak = 1
      }

      db.stats.lastStreakDate = today
      if (db.stats.currentStreak > db.stats.bestStreak) {
        db.stats.bestStreak = db.stats.currentStreak
      }
    }
  }
}

export function getStats(): Stats {
  return db.stats
}

// Daily Notes functions
export function getDailyNote(date: string): DailyNote | null {
  return db.dailyNotes.find(n => n.date === date) || null
}

export function saveDailyNote(date: string, content: string): DailyNote {
  const existingIndex = db.dailyNotes.findIndex(n => n.date === date)
  const note: DailyNote = {
    date,
    content,
    updated_at: new Date().toISOString()
  }

  if (existingIndex !== -1) {
    db.dailyNotes[existingIndex] = note
  } else {
    db.dailyNotes.push(note)
  }

  saveDatabase()
  return note
}

export function getRecentNotes(limit: number = 7): DailyNote[] {
  return db.dailyNotes
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
}

// Twitter settings
export function getTwitterSettings(): TwitterSettings {
  return db.twitter
}

export function saveTwitterSettings(settings: Partial<TwitterSettings>): TwitterSettings {
  if (settings.bearerToken !== undefined) db.twitter.bearerToken = settings.bearerToken
  if (settings.username !== undefined) db.twitter.username = settings.username
  if (settings.userId !== undefined) db.twitter.userId = settings.userId
  if (settings.listIds !== undefined) db.twitter.listIds = settings.listIds
  if (settings.apiKey !== undefined) db.twitter.apiKey = settings.apiKey
  if (settings.apiSecret !== undefined) db.twitter.apiSecret = settings.apiSecret
  if (settings.accessToken !== undefined) db.twitter.accessToken = settings.accessToken
  if (settings.accessTokenSecret !== undefined) db.twitter.accessTokenSecret = settings.accessTokenSecret
  saveDatabase()
  return db.twitter
}

// RSS Feeds
export function getRSSFeeds(): RSSFeed[] {
  return db.rssFeeds
}

export function addRSSFeed(feed: RSSFeed): RSSFeed[] {
  if (!db.rssFeeds.find(f => f.url === feed.url)) {
    db.rssFeeds.push(feed)
    saveDatabase()
  }
  return db.rssFeeds
}

export function removeRSSFeed(url: string): RSSFeed[] {
  db.rssFeeds = db.rssFeeds.filter(f => f.url !== url)
  saveDatabase()
  return db.rssFeeds
}

export function getClaudeApiKey(): string {
  return db.claudeApiKey || ''
}

export function saveClaudeApiKey(key: string): void {
  db.claudeApiKey = key
  saveDatabase()
}

export function getTavilyApiKey(): string {
  return db.tavilyApiKey || ''
}

export function saveTavilyApiKey(key: string): void {
  db.tavilyApiKey = key
  saveDatabase()
}

// Activity Log functions
function logActivity(type: string, data: { categoryName?: string; minutes?: number }) {
  const today = new Date().toISOString().split('T')[0]
  let entry = db.activityLog.find(e => e.date === today)
  if (!entry) {
    entry = { date: today, tasksCompleted: 0, focusMinutes: 0, categoriesWorked: [] }
    db.activityLog.push(entry)
  }

  if (type === 'task_complete') {
    entry.tasksCompleted++
    if (data.categoryName && !entry.categoriesWorked.includes(data.categoryName)) {
      entry.categoriesWorked.push(data.categoryName)
    }
  } else if (type === 'task_uncomplete') {
    entry.tasksCompleted = Math.max(0, entry.tasksCompleted - 1)
  } else if (type === 'focus_minutes') {
    entry.focusMinutes += data.minutes || 0
  }

  saveDatabase()
}

export function getActivityLog(days: number = 90): ActivityEntry[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return db.activityLog.filter(e => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date))
}

// Pomodoro functions
export function getPomodoroState(): PomodoroState {
  const today = new Date().toISOString().split('T')[0]
  if (db.pomodoroState.todayDate !== today) {
    db.pomodoroState.totalSessionsToday = 0
    db.pomodoroState.sessionsCompleted = 0
    db.pomodoroState.todayDate = today
    saveDatabase()
  }
  return db.pomodoroState
}

export function startPomodoro(taskId: number | null, taskTitle: string, durationMinutes: number = 25): PomodoroState {
  db.pomodoroState.isRunning = true
  db.pomodoroState.currentSession = {
    taskId,
    taskTitle,
    startedAt: new Date().toISOString(),
    durationMinutes,
    type: 'work'
  }
  saveDatabase()
  return db.pomodoroState
}

export function completePomodoro(): PomodoroState {
  if (db.pomodoroState.currentSession?.type === 'work') {
    db.pomodoroState.sessionsCompleted++
    db.pomodoroState.totalSessionsToday++
    logActivity('focus_minutes', { minutes: db.pomodoroState.currentSession.durationMinutes })
  }
  db.pomodoroState.isRunning = false
  db.pomodoroState.currentSession = null
  saveDatabase()
  return db.pomodoroState
}

export function startBreak(type: 'short_break' | 'long_break'): PomodoroState {
  const duration = type === 'short_break' ? 5 : 15
  db.pomodoroState.isRunning = true
  db.pomodoroState.currentSession = {
    taskId: null,
    taskTitle: type === 'short_break' ? 'Short Break' : 'Long Break',
    startedAt: new Date().toISOString(),
    durationMinutes: duration,
    type
  }
  saveDatabase()
  return db.pomodoroState
}

export function stopPomodoro(): PomodoroState {
  db.pomodoroState.isRunning = false
  db.pomodoroState.currentSession = null
  saveDatabase()
  return db.pomodoroState
}

// Morning Briefing functions
export function getMorningBriefing(date: string): MorningBriefing | null {
  return db.morningBriefings.find(b => b.date === date) || null
}

export function saveMorningBriefing(briefing: MorningBriefing): MorningBriefing {
  const existingIndex = db.morningBriefings.findIndex(b => b.date === briefing.date)
  if (existingIndex !== -1) {
    db.morningBriefings[existingIndex] = briefing
  } else {
    db.morningBriefings.push(briefing)
  }
  saveDatabase()
  return briefing
}

export function dismissMorningBriefing(date: string): void {
  const briefing = db.morningBriefings.find(b => b.date === date)
  if (briefing) {
    briefing.dismissed = true
    saveDatabase()
  }
}

export function getBriefingData(): {
  overdueTasks: Task[]
  todayTasks: Task[]
  highPriorityTasks: Task[]
  stats: Stats
  recentNotes: DailyNote[]
  streak: number
} {
  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = db.tasks.filter(t => !t.completed && t.due_date && t.due_date < today)
  const todayTasks = db.tasks.filter(t => !t.completed && t.due_date === today)
  const highPriorityTasks = db.tasks.filter(t => !t.completed && t.priority === 1)
  const recentNotes = db.dailyNotes
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return {
    overdueTasks,
    todayTasks,
    highPriorityTasks,
    stats: db.stats,
    recentNotes,
    streak: db.stats.currentStreak
  }
}

// Weekly Review functions
export function getWeeklyReview(weekStart: string): WeeklyReview | null {
  return db.weeklyReviews.find(r => r.weekStartDate === weekStart) || null
}

export function saveWeeklyReview(review: WeeklyReview): WeeklyReview {
  const existingIndex = db.weeklyReviews.findIndex(r => r.weekStartDate === review.weekStartDate)
  if (existingIndex !== -1) {
    db.weeklyReviews[existingIndex] = review
  } else {
    db.weeklyReviews.push(review)
  }
  saveDatabase()
  return review
}

export function getAllWeeklyReviews(): WeeklyReview[] {
  return db.weeklyReviews.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
}

export function getWeeklyReviewData(weekStart: string): {
  completedTasks: Task[]
  focusMinutes: number
  notesWritten: DailyNote[]
  categoriesWorked: string[]
  streak: number
} {
  const weekEnd = new Date(weekStart + 'T00:00:00')
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const completedTasks = db.tasks.filter(t =>
    t.completed && t.updated_at && t.updated_at >= weekStart && t.updated_at < weekEndStr
  )

  const weekActivity = db.activityLog.filter(e => e.date >= weekStart && e.date < weekEndStr)
  const focusMinutes = weekActivity.reduce((sum, e) => sum + e.focusMinutes, 0)
  const categoriesWorked = [...new Set(weekActivity.flatMap(e => e.categoriesWorked))]

  const notesWritten = db.dailyNotes.filter(n => n.date >= weekStart && n.date < weekEndStr)

  return {
    completedTasks,
    focusMinutes,
    notesWritten,
    categoriesWorked,
    streak: db.stats.currentStreak
  }
}

export function checkWeeklyReviewNeeded(): { needed: boolean; weekStart: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Check on Sunday (0) if review exists for the past week (Monday start)
  const lastMonday = new Date(now)
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  lastMonday.setDate(lastMonday.getDate() - diff)
  const weekStartStr = lastMonday.toISOString().split('T')[0]
  const existing = db.weeklyReviews.find(r => r.weekStartDate === weekStartStr)
  return { needed: dayOfWeek === 0 && !existing, weekStart: weekStartStr }
}

// Chat Conversation CRUD
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getChatConversations(): ChatConversation[] {
  return (db.chatConversations || [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getChatConversation(id: string): ChatConversation | null {
  return db.chatConversations.find(c => c.id === id) || null
}

export function createChatConversation(title: string): ChatConversation {
  const conv: ChatConversation = {
    id: generateId(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.chatConversations.push(conv)
  saveDatabase()
  return conv
}

export function addChatMessage(conversationId: string, message: ChatMessage): ChatConversation | null {
  const conv = db.chatConversations.find(c => c.id === conversationId)
  if (!conv) return null
  conv.messages.push(message)
  conv.updatedAt = new Date().toISOString()
  saveDatabase()
  return conv
}

export function deleteChatConversation(id: string): void {
  db.chatConversations = db.chatConversations.filter(c => c.id !== id)
  saveDatabase()
}

export function renameChatConversation(id: string, title: string): ChatConversation | null {
  const conv = db.chatConversations.find(c => c.id === id)
  if (!conv) return null
  conv.title = title
  conv.updatedAt = new Date().toISOString()
  saveDatabase()
  return conv
}

export function getChatSettings(): ChatSettings {
  return db.chatSettings
}

export function saveChatSettings(updates: Partial<ChatSettings>): ChatSettings {
  if (updates.model !== undefined) db.chatSettings.model = updates.model
  if (updates.systemPromptMode !== undefined) db.chatSettings.systemPromptMode = updates.systemPromptMode
  if (updates.maxTokens !== undefined) db.chatSettings.maxTokens = updates.maxTokens
  if (updates.customSystemPrompt !== undefined) db.chatSettings.customSystemPrompt = updates.customSystemPrompt
  saveDatabase()
  return db.chatSettings
}

// Tweet Draft CRUD
export function getTweetDrafts(): TweetDraft[] {
  return (db.tweetDrafts || [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getTweetDraft(id: string): TweetDraft | null {
  return db.tweetDrafts.find(d => d.id === id) || null
}

export function createTweetDraft(topic?: string): TweetDraft {
  const draft: TweetDraft = {
    id: generateId(),
    text: '',
    segments: [''],
    isThread: false,
    status: 'draft',
    topic: topic || undefined,
    aiHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    threadTweetIds: []
  }
  db.tweetDrafts.push(draft)
  saveDatabase()
  return draft
}

export function updateTweetDraft(id: string, updates: Partial<TweetDraft>): TweetDraft | null {
  const draft = db.tweetDrafts.find(d => d.id === id)
  if (!draft) return null
  if (updates.text !== undefined) draft.text = updates.text
  if (updates.segments !== undefined) draft.segments = updates.segments
  if (updates.isThread !== undefined) draft.isThread = updates.isThread
  if (updates.status !== undefined) draft.status = updates.status
  if (updates.topic !== undefined) draft.topic = updates.topic
  if (updates.postedAt !== undefined) draft.postedAt = updates.postedAt
  if (updates.tweetId !== undefined) draft.tweetId = updates.tweetId
  if (updates.threadTweetIds !== undefined) draft.threadTweetIds = updates.threadTweetIds
  draft.updatedAt = new Date().toISOString()
  saveDatabase()
  return draft
}

export function addTweetAIMessage(draftId: string, msg: TweetAIMessage): TweetDraft | null {
  const draft = db.tweetDrafts.find(d => d.id === draftId)
  if (!draft) return null
  draft.aiHistory.push(msg)
  draft.updatedAt = new Date().toISOString()
  saveDatabase()
  return draft
}

export function deleteTweetDraft(id: string): void {
  db.tweetDrafts = db.tweetDrafts.filter(d => d.id !== id)
  saveDatabase()
}

// Tweet Persona CRUD
export function getTweetPersonas(): TweetPersona[] {
  return db.tweetPersonas || []
}

export function createTweetPersona(data: { name: string; description: string; exampleTweets: string[] }): TweetPersona {
  const persona: TweetPersona = {
    id: generateId(),
    name: data.name,
    description: data.description,
    exampleTweets: data.exampleTweets,
    isBuiltIn: false,
    createdAt: new Date().toISOString()
  }
  db.tweetPersonas.push(persona)
  saveDatabase()
  return persona
}

export function deleteTweetPersona(id: string): void {
  db.tweetPersonas = db.tweetPersonas.filter(p => p.id !== id)
  saveDatabase()
}

// AI Tasks CRUD
export function getAITasks(): AITask[] {
  return db.aiTasks || []
}

export function createAITask(data: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }): AITask {
  const task: AITask = {
    id: generateId(),
    title: data.title,
    description: data.description,
    column: 'backlog',
    priority: data.priority,
    tags: data.tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.aiTasks.push(task)
  saveDatabase()
  syncAITasksFile()
  return task
}

export function updateAITask(id: string, updates: Partial<AITask>): AITask | null {
  const task = db.aiTasks.find(t => t.id === id)
  if (!task) return null
  if (updates.title !== undefined) task.title = updates.title
  if (updates.description !== undefined) task.description = updates.description
  if (updates.priority !== undefined) task.priority = updates.priority
  if (updates.tags !== undefined) task.tags = updates.tags
  if (updates.column !== undefined) task.column = updates.column
  task.updatedAt = new Date().toISOString()
  saveDatabase()
  syncAITasksFile()
  return task
}

export function deleteAITask(id: string): void {
  db.aiTasks = db.aiTasks.filter(t => t.id !== id)
  saveDatabase()
  syncAITasksFile()
}

export function moveAITask(id: string, column: AITask['column']): AITask | null {
  const task = db.aiTasks.find(t => t.id === id)
  if (!task) return null
  task.column = column
  task.updatedAt = new Date().toISOString()
  saveDatabase()
  syncAITasksFile()
  return task
}

// Memory CRUD
export function getMemories(): Memory[] {
  return (db.memories || [])
    .filter(m => !m.isArchived)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getAllMemories(): Memory[] {
  return db.memories || []
}

export function createMemory(data: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Memory {
  const memory: Memory = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.memories.push(memory)
  updateTopicCounts()
  saveDatabase()
  return memory
}

export function updateMemory(id: string, updates: Partial<Memory>): Memory | null {
  const mem = db.memories.find(m => m.id === id)
  if (!mem) return null
  if (updates.title !== undefined) mem.title = updates.title
  if (updates.content !== undefined) mem.content = updates.content
  if (updates.topics !== undefined) mem.topics = updates.topics
  if (updates.importance !== undefined) mem.importance = updates.importance
  if (updates.isPinned !== undefined) mem.isPinned = updates.isPinned
  if (updates.isArchived !== undefined) mem.isArchived = updates.isArchived
  if (updates.relatedMemoryIds !== undefined) mem.relatedMemoryIds = updates.relatedMemoryIds
  if (updates.sourcePreview !== undefined) mem.sourcePreview = updates.sourcePreview
  mem.updatedAt = new Date().toISOString()
  updateTopicCounts()
  saveDatabase()
  return mem
}

export function deleteMemory(id: string): void {
  db.memories = db.memories.filter(m => m.id !== id)
  // Remove from relatedMemoryIds of other memories
  db.memories.forEach(m => {
    m.relatedMemoryIds = m.relatedMemoryIds.filter(rid => rid !== id)
  })
  updateTopicCounts()
  saveDatabase()
}

export function archiveMemory(id: string): Memory | null {
  const mem = db.memories.find(m => m.id === id)
  if (!mem) return null
  mem.isArchived = !mem.isArchived
  mem.updatedAt = new Date().toISOString()
  updateTopicCounts()
  saveDatabase()
  return mem
}

export function pinMemory(id: string): Memory | null {
  const mem = db.memories.find(m => m.id === id)
  if (!mem) return null
  mem.isPinned = !mem.isPinned
  mem.updatedAt = new Date().toISOString()
  saveDatabase()
  return mem
}

export function getMemoryTopics(): MemoryTopic[] {
  return db.memoryTopics || []
}

export function updateMemoryTopics(topics: MemoryTopic[]): MemoryTopic[] {
  db.memoryTopics = topics
  saveDatabase()
  return db.memoryTopics
}

export function getMemorySettings(): MemorySettings {
  return db.memorySettings
}

export function saveMemorySettings(updates: Partial<MemorySettings>): MemorySettings {
  if (updates.autoGenerate !== undefined) db.memorySettings.autoGenerate = updates.autoGenerate
  if (updates.maxMemoriesInContext !== undefined) db.memorySettings.maxMemoriesInContext = updates.maxMemoriesInContext
  if (updates.tokenBudget !== undefined) db.memorySettings.tokenBudget = updates.tokenBudget
  saveDatabase()
  return db.memorySettings
}

// Welcome modal
export function isWelcomeDismissed(): boolean {
  return db.welcomeDismissed || false
}

export function dismissWelcome(): void {
  db.welcomeDismissed = true
  saveDatabase()
}

function updateTopicCounts(): void {
  const topicMap = new Map<string, number>()
  const activeMemories = db.memories.filter(m => !m.isArchived)
  activeMemories.forEach(m => {
    m.topics.forEach(t => {
      topicMap.set(t, (topicMap.get(t) || 0) + 1)
    })
  })
  // Merge with existing topic colors
  const existingTopics = new Map(db.memoryTopics.map(t => [t.name, t.color]))
  const defaultColors = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#22d3ee', '#fb923c']
  let colorIdx = 0
  db.memoryTopics = Array.from(topicMap.entries()).map(([name, count]) => ({
    name,
    color: existingTopics.get(name) || defaultColors[colorIdx++ % defaultColors.length],
    memoryCount: count
  }))
}

function syncAITasksFile(): void {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const claudeDir = path.join(homeDir, '.claude')
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }
    const filePath = path.join(claudeDir, 'ai-tasks.md')

    const columns: { key: AITask['column']; label: string }[] = [
      { key: 'backlog', label: 'Backlog' },
      { key: 'todo', label: 'Todo' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'done', label: 'Done' }
    ]

    let content = '# AI Tasks & Ideas\n'

    for (const col of columns) {
      content += `\n## ${col.label}\n`
      const tasks = (db.aiTasks || []).filter(t => t.column === col.key)
      if (tasks.length === 0) {
        content += '\n_No tasks_\n'
      } else {
        for (const task of tasks) {
          const tags = task.tags.length > 0 ? ' ' + task.tags.map(t => `\`#${t}\``).join(' ') : ''
          if (col.key === 'done') {
            const completedDate = task.updatedAt.split('T')[0]
            content += `- **${task.title}**${task.description ? ' — ' + task.description : ''} (completed ${completedDate})${tags}\n`
          } else {
            content += `- [${task.priority}] **${task.title}**${task.description ? ' — ' + task.description : ''}${tags}\n`
          }
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8')
  } catch {
    // Silently fail — file sync is best-effort
  }
}

// Roadmap Goals CRUD
export function getRoadmapGoals(): RoadmapGoal[] {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return (db.roadmapGoals || []).sort((a, b) => {
    if (a.targetYear !== b.targetYear) return a.targetYear - b.targetYear
    if (a.targetQuarter !== b.targetQuarter) return a.targetQuarter - b.targetQuarter
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export function createRoadmapGoal(data: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'>): RoadmapGoal {
  const goal: RoadmapGoal = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  db.roadmapGoals.push(goal)
  saveDatabase()
  syncRoadmapFiles()
  return goal
}

export function updateRoadmapGoal(id: string, updates: Partial<RoadmapGoal>): RoadmapGoal | null {
  const goal = db.roadmapGoals.find(g => g.id === id)
  if (!goal) return null
  if (updates.title !== undefined) goal.title = updates.title
  if (updates.description !== undefined) goal.description = updates.description
  if (updates.category !== undefined) goal.category = updates.category
  if (updates.targetQuarter !== undefined) goal.targetQuarter = updates.targetQuarter
  if (updates.targetYear !== undefined) goal.targetYear = updates.targetYear
  if (updates.priority !== undefined) goal.priority = updates.priority
  if (updates.status !== undefined) goal.status = updates.status
  if (updates.research_questions !== undefined) goal.research_questions = updates.research_questions
  if (updates.guidance_needed !== undefined) goal.guidance_needed = updates.guidance_needed
  if (updates.notes !== undefined) goal.notes = updates.notes
  if (updates.sub_goals !== undefined) goal.sub_goals = updates.sub_goals
  if (updates.tags !== undefined) goal.tags = updates.tags
  if (updates.topicReports !== undefined) goal.topicReports = updates.topicReports
  if (updates.personalContext !== undefined) goal.personalContext = updates.personalContext
  if (updates.contextFiles !== undefined) goal.contextFiles = updates.contextFiles
  goal.updatedAt = new Date().toISOString()
  saveDatabase()
  syncRoadmapFiles()
  return goal
}

export function deleteRoadmapGoal(id: string): void {
  db.roadmapGoals = db.roadmapGoals.filter(g => g.id !== id)
  saveDatabase()
  syncRoadmapFiles()
}

function escapeYaml(str: string): string {
  if (!str) return '""'
  if (/[:\-#{}\[\],&*?|>!%@`"']/.test(str) || str.includes('\n') || str.startsWith(' ') || str.endsWith(' ')) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'
  }
  return str
}

function syncRoadmapFiles(): void {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const claudeDir = path.join(homeDir, '.claude')
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true })
    }

    const goals = getRoadmapGoals()

    // Write YAML
    let yaml = 'goals:\n'
    for (const g of goals) {
      yaml += `  - id: ${escapeYaml(g.id)}\n`
      yaml += `    title: ${escapeYaml(g.title)}\n`
      yaml += `    category: ${g.category}\n`
      yaml += `    target: Q${g.targetQuarter} ${g.targetYear}\n`
      yaml += `    priority: ${g.priority}\n`
      yaml += `    status: ${g.status}\n`
      if (g.description) {
        yaml += `    description: ${escapeYaml(g.description)}\n`
      }
      if (g.research_questions.length > 0) {
        yaml += `    research_questions:\n`
        for (const q of g.research_questions) {
          yaml += `      - ${escapeYaml(q)}\n`
        }
      }
      if (g.guidance_needed.length > 0) {
        yaml += `    guidance_needed:\n`
        for (const gn of g.guidance_needed) {
          yaml += `      - ${escapeYaml(gn)}\n`
        }
      }
      if (g.sub_goals.length > 0) {
        yaml += `    sub_goals:\n`
        for (const sg of g.sub_goals) {
          yaml += `      - title: ${escapeYaml(sg.title)}\n`
          yaml += `        status: ${sg.status}\n`
        }
      }
      if (g.tags.length > 0) {
        yaml += `    tags: [${g.tags.map(t => escapeYaml(t)).join(', ')}]\n`
      }
      if (g.notes) {
        yaml += `    notes: ${escapeYaml(g.notes)}\n`
      }
    }
    fs.writeFileSync(path.join(claudeDir, 'roadmap.yaml'), yaml, 'utf-8')

    // Write Markdown
    const statusIcon: Record<string, string> = { not_started: ' ', in_progress: '~', completed: 'x', on_hold: '-' }
    let md = '# Life Roadmap\n'
    const byYear = new Map<number, RoadmapGoal[]>()
    for (const g of goals) {
      if (!byYear.has(g.targetYear)) byYear.set(g.targetYear, [])
      byYear.get(g.targetYear)!.push(g)
    }
    for (const [year, yearGoals] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
      md += `\n## ${year}\n`
      const byQ = new Map<number, RoadmapGoal[]>()
      for (const g of yearGoals) {
        if (!byQ.has(g.targetQuarter)) byQ.set(g.targetQuarter, [])
        byQ.get(g.targetQuarter)!.push(g)
      }
      for (const [q, qGoals] of [...byQ.entries()].sort((a, b) => a[0] - b[0])) {
        md += `\n### Q${q} ${year}\n\n`
        for (const g of qGoals) {
          md += `- [${statusIcon[g.status] || ' '}] **${g.title}** _(${g.category}, ${g.priority} priority)_\n`
          if (g.description) {
            md += `  ${g.description}\n`
          }
          for (const sg of g.sub_goals) {
            md += `  - [${statusIcon[sg.status] || ' '}] ${sg.title}\n`
          }
          if (g.research_questions.length > 0) {
            md += `  - **Research needed:**\n`
            for (const rq of g.research_questions) {
              md += `    - ${rq}\n`
            }
          }
          if (g.guidance_needed.length > 0) {
            md += `  - **Guidance needed:**\n`
            for (const gn of g.guidance_needed) {
              md += `    - ${gn}\n`
            }
          }
        }
      }
    }
    fs.writeFileSync(path.join(claudeDir, 'roadmap.md'), md, 'utf-8')
  } catch {
    // Silently fail — file sync is best-effort
  }
}

// Master Plan CRUD
export function getMasterPlan(): Database['masterPlan'] {
  return db.masterPlan || null
}

export function saveMasterPlan(plan: NonNullable<Database['masterPlan']>): NonNullable<Database['masterPlan']> {
  db.masterPlan = plan
  saveDatabase()
  return plan
}

export function clearMasterPlan(): void {
  db.masterPlan = null
  saveDatabase()
}

// Master Plan Tasks CRUD
export function getMasterPlanTasks(planDate?: string): MasterPlanTask[] {
  const tasks = db.masterPlanTasks || []
  if (planDate) return tasks.filter(t => t.planDate === planDate)
  return tasks
}

export function createMasterPlanTask(data: Omit<MasterPlanTask, 'id' | 'createdAt'>): MasterPlanTask {
  const task: MasterPlanTask = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString()
  }
  db.masterPlanTasks.push(task)
  saveDatabase()
  return task
}

export function updateMasterPlanTask(id: string, updates: Partial<MasterPlanTask>): MasterPlanTask | null {
  const task = db.masterPlanTasks.find(t => t.id === id)
  if (!task) return null
  if (updates.status !== undefined) task.status = updates.status
  if (updates.launchedAt !== undefined) task.launchedAt = updates.launchedAt
  if (updates.completedAt !== undefined) task.completedAt = updates.completedAt
  if (updates.sessionId !== undefined) task.sessionId = updates.sessionId
  saveDatabase()
  return task
}

export function clearMasterPlanTasks(planDate: string): void {
  db.masterPlanTasks = db.masterPlanTasks.filter(t => t.planDate !== planDate)
  saveDatabase()
}
