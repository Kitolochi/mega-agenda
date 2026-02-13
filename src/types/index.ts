export interface Task {
  id: number
  category_id: number
  title: string
  description?: string
  priority: number
  due_date?: string
  completed: number
  created_at: string
  updated_at?: string
  is_recurring: boolean
  recurrence_type?: 'daily' | 'weekly' | 'monthly'
  recurrence_interval?: number
  last_completed?: string
}

export interface Category {
  id: number
  name: string
  color: string
  icon: string
  sort_order: number
}

export interface DailyNote {
  date: string
  content: string
  updated_at: string
}

export interface Stats {
  currentStreak: number
  bestStreak: number
  lastStreakDate: string
  tasksCompletedThisWeek: number
  weekStartDate: string
}

export interface TwitterSettings {
  bearerToken: string
  username: string
  userId: string
  listIds: { id: string; name: string }[]
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
}

export interface Tweet {
  id: string
  text: string
  authorName: string
  authorUsername: string
  authorAvatar: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  listName: string
}

export interface RSSFeed {
  url: string
  name: string
  category: string
}

export interface FeedItem {
  id: string
  title: string
  description: string
  link: string
  author: string
  pubDate: string
  feedName: string
}

export interface ActivityEntry {
  date: string
  tasksCompleted: number
  focusMinutes: number
  categoriesWorked: string[]
}

export interface PomodoroSession {
  taskId: number | null
  taskTitle: string
  startedAt: string
  durationMinutes: number
  type: 'work' | 'short_break' | 'long_break'
}

export interface PomodoroState {
  isRunning: boolean
  currentSession: PomodoroSession | null
  sessionsCompleted: number
  totalSessionsToday: number
  todayDate: string
}

export interface MorningBriefing {
  date: string
  content: string
  isAiEnhanced: boolean
  dismissed: boolean
  generatedAt: string
}

export interface WeeklyReview {
  weekStartDate: string
  content: string
  generatedAt: string
  tasksCompletedCount: number
  categoriesWorked: string[]
  streakAtGeneration: number
}

export interface VoiceCommand {
  action: 'add_task' | 'complete_task' | 'switch_tab' | 'open_modal' | 'add_note' | 'summarize_feed' | 'unknown'
  category?: string
  title?: string
  priority?: number
  description?: string
  tab?: string
  note?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  tokenUsage?: { input: number; output: number }
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  systemPrompt?: string
}

export interface ChatSettings {
  model: string
  systemPromptMode: 'default' | 'context' | 'custom'
  maxTokens: number
  customSystemPrompt?: string
}

export interface CLISession {
  sessionId: string
  firstPrompt: string
  messageCount: number
  created: string
  modified: string
  project: string
}

export interface CLISessionMessage {
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  uuid?: string
}

export interface ElectronAPI {
  // Task operations
  getCategories: () => Promise<Category[]>
  addCategory: (name: string, color: string, icon: string) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  getTasks: (categoryId?: number) => Promise<Task[]>
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'last_completed'>) => Promise<Task>
  updateTask: (id: number, updates: Partial<Task>) => Promise<Task>
  deleteTask: (id: number) => Promise<void>
  toggleTask: (id: number) => Promise<Task>

  // Notes operations
  getDailyNote: (date: string) => Promise<DailyNote | null>
  saveDailyNote: (date: string, content: string) => Promise<DailyNote>
  getRecentNotes: (limit?: number) => Promise<DailyNote[]>

  // Stats
  getStats: () => Promise<Stats>

  // Twitter
  getTwitterSettings: () => Promise<TwitterSettings>
  saveTwitterSettings: (settings: Partial<TwitterSettings>) => Promise<TwitterSettings>
  verifyTwitterToken: (token: string) => Promise<{ valid: boolean; error?: string }>
  twitterGetUser: (token: string, username: string) => Promise<{ id: string; username: string; name: string } | null>
  twitterGetLists: (token: string, userId: string) => Promise<{ id: string; name: string }[]>
  twitterFetchFeed: (token: string, lists: { id: string; name: string }[]) => Promise<Tweet[]>

  // RSS
  getRSSFeeds: () => Promise<RSSFeed[]>
  addRSSFeed: (url: string, name: string, category: string) => Promise<RSSFeed[]>
  removeRSSFeed: (url: string) => Promise<RSSFeed[]>
  fetchRSSFeeds: (feeds: RSSFeed[]) => Promise<FeedItem[]>

  // Claude API
  getClaudeApiKey: () => Promise<string>
  saveClaudeApiKey: (key: string) => Promise<boolean>
  verifyClaudeKey: (key: string) => Promise<{ valid: boolean; error?: string }>
  summarizeFeed: (apiKey: string, articles: { title: string; description: string }[], section: string) => Promise<string>
  parseVoiceCommand: (apiKey: string, transcript: string, categoryNames: string[]) => Promise<VoiceCommand>

  // Tweet posting
  postTweet: (text: string) => Promise<{ success: boolean; tweetId?: string; error?: string }>
  verifyTwitterOAuth: () => Promise<{ valid: boolean; username?: string; error?: string }>

  // Activity Log
  getActivityLog: (days?: number) => Promise<ActivityEntry[]>

  // Pomodoro
  getPomodoroState: () => Promise<PomodoroState>
  startPomodoro: (taskId: number | null, taskTitle: string, durationMinutes?: number) => Promise<PomodoroState>
  completePomodoro: () => Promise<PomodoroState>
  startBreak: (type: 'short_break' | 'long_break') => Promise<PomodoroState>
  stopPomodoro: () => Promise<PomodoroState>

  // Morning Briefing
  getMorningBriefing: (date: string) => Promise<MorningBriefing | null>
  generateMorningBriefing: () => Promise<MorningBriefing>
  dismissMorningBriefing: (date: string) => Promise<void>

  // Weekly Review
  getWeeklyReview: (weekStart: string) => Promise<WeeklyReview | null>
  getAllWeeklyReviews: () => Promise<WeeklyReview[]>
  generateWeeklyReview: (weekStart: string) => Promise<WeeklyReview>
  checkWeeklyReviewNeeded: () => Promise<{ needed: boolean; weekStart: string }>

  // Notifications
  showNotification: (title: string, body: string) => Promise<void>

  // Terminal
  createTerminal: (cols: number, rows: number) => Promise<void>
  writeTerminal: (data: string) => Promise<void>
  resizeTerminal: (cols: number, rows: number) => Promise<void>
  killTerminal: () => Promise<void>
  onTerminalData: (callback: (data: string) => void) => () => void

  // Clipboard
  readClipboard: () => string
  writeClipboard: (text: string) => void

  // Utilities
  openExternal: (url: string) => Promise<void>

  // Window controls
  closeWindow: () => void
  minimizeWindow: () => void
  onOpenAddModal: (callback: () => void) => () => void

  // Chat conversations
  getChatConversations: () => Promise<ChatConversation[]>
  getChatConversation: (id: string) => Promise<ChatConversation | null>
  createChatConversation: (title: string) => Promise<ChatConversation>
  addChatMessage: (conversationId: string, message: ChatMessage) => Promise<ChatConversation>
  deleteChatConversation: (id: string) => Promise<void>
  renameChatConversation: (id: string, title: string) => Promise<ChatConversation>

  // Chat settings
  getChatSettings: () => Promise<ChatSettings>
  saveChatSettings: (settings: Partial<ChatSettings>) => Promise<ChatSettings>

  // Chat streaming
  chatSendMessage: (conversationId: string, messages: { role: string; content: string }[], systemPrompt?: string) => Promise<void>
  chatAbort: () => Promise<void>
  onChatStreamChunk: (callback: (data: { conversationId: string; text: string }) => void) => () => void
  onChatStreamEnd: (callback: (data: { conversationId: string; model: string; usage: { input: number; output: number } }) => void) => () => void
  onChatStreamError: (callback: (data: { conversationId: string; error: string }) => void) => () => void

  // CLI logs
  getCliSessions: () => Promise<CLISession[]>
  getCliSessionMessages: (sessionId: string, offset?: number, limit?: number) => Promise<{ messages: CLISessionMessage[]; hasMore: boolean }>
  searchCliSessions: (query: string) => Promise<{ sessionId: string; firstPrompt: string; matches: string[] }[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
