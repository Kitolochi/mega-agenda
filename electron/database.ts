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

interface Database {
  categories: Category[]
  tasks: Task[]
  dailyNotes: DailyNote[]
  nextTaskId: number
  stats: Stats
  twitter: TwitterSettings
  rssFeeds: RSSFeed[]
  claudeApiKey: string
  activityLog: ActivityEntry[]
  pomodoroState: PomodoroState
  morningBriefings: MorningBriefing[]
  weeklyReviews: WeeklyReview[]
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
      activityLog: [],
      pomodoroState: {
        isRunning: false,
        currentSession: null,
        sessionsCompleted: 0,
        totalSessionsToday: 0,
        todayDate: new Date().toISOString().split('T')[0]
      },
      morningBriefings: [],
      weeklyReviews: []
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

  // Reset weekly stats if new week
  checkWeeklyReset()

  // Check and reset recurring tasks on startup
  checkRecurringTasks()

  return db
}

function saveDatabase() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8')
}

function checkRecurringTasks() {
  const today = new Date().toISOString().split('T')[0]

  db.tasks.forEach(task => {
    if (task.is_recurring && task.completed && task.last_completed) {
      const lastCompleted = new Date(task.last_completed)
      const now = new Date()
      let shouldReset = false

      if (task.recurrence_type === 'daily') {
        const interval = task.recurrence_interval || 1
        const daysDiff = Math.floor((now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24))
        shouldReset = daysDiff >= interval
      } else if (task.recurrence_type === 'weekly') {
        const interval = task.recurrence_interval || 1
        const daysDiff = Math.floor((now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24))
        shouldReset = daysDiff >= (interval * 7)
      } else if (task.recurrence_type === 'monthly') {
        const interval = task.recurrence_interval || 1
        const monthsDiff = (now.getFullYear() - lastCompleted.getFullYear()) * 12 +
                          (now.getMonth() - lastCompleted.getMonth())
        shouldReset = monthsDiff >= interval
      }

      if (shouldReset) {
        task.completed = 0
        task.updated_at = new Date().toISOString()
      }
    }
  })

  saveDatabase()
}

export function getCategories(): Category[] {
  return db.categories.sort((a, b) => a.sort_order - b.sort_order)
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
    if (task.is_recurring) {
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
