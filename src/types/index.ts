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

export interface VoiceCommand {
  action: 'add_task' | 'complete_task' | 'switch_tab' | 'open_modal' | 'add_note' | 'summarize_feed' | 'unknown'
  category?: string
  title?: string
  priority?: number
  description?: string
  tab?: string
  note?: string
}

export interface ElectronAPI {
  // Task operations
  getCategories: () => Promise<Category[]>
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

  // Utilities
  openExternal: (url: string) => Promise<void>

  // Window controls
  closeWindow: () => void
  minimizeWindow: () => void
  onOpenAddModal: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
