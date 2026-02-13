import { contextBridge, ipcRenderer } from 'electron'

export interface Task {
  id?: number
  category_id: number
  title: string
  description?: string
  priority: number
  due_date?: string
  completed: number
  created_at?: string
  updated_at?: string
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

contextBridge.exposeInMainWorld('electronAPI', {
  // Task operations
  getCategories: () => ipcRenderer.invoke('get-categories'),
  getTasks: (categoryId?: number) => ipcRenderer.invoke('get-tasks', categoryId),
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => ipcRenderer.invoke('add-task', task),
  updateTask: (id: number, updates: Partial<Task>) => ipcRenderer.invoke('update-task', id, updates),
  deleteTask: (id: number) => ipcRenderer.invoke('delete-task', id),
  toggleTask: (id: number) => ipcRenderer.invoke('toggle-task', id),

  // Notes operations
  getDailyNote: (date: string) => ipcRenderer.invoke('get-daily-note', date),
  saveDailyNote: (date: string, content: string) => ipcRenderer.invoke('save-daily-note', date, content),
  getRecentNotes: (limit?: number) => ipcRenderer.invoke('get-recent-notes', limit),

  // Stats
  getStats: () => ipcRenderer.invoke('get-stats'),

  // Twitter
  getTwitterSettings: () => ipcRenderer.invoke('get-twitter-settings'),
  saveTwitterSettings: (settings: any) => ipcRenderer.invoke('save-twitter-settings', settings),
  verifyTwitterToken: (token: string) => ipcRenderer.invoke('verify-twitter-token', token),
  twitterGetUser: (token: string, username: string) => ipcRenderer.invoke('twitter-get-user', token, username),
  twitterGetLists: (token: string, userId: string) => ipcRenderer.invoke('twitter-get-lists', token, userId),
  twitterFetchFeed: (token: string, lists: any[]) => ipcRenderer.invoke('twitter-fetch-feed', token, lists),

  // Tweet posting
  postTweet: (text: string) => ipcRenderer.invoke('post-tweet', text),
  verifyTwitterOAuth: () => ipcRenderer.invoke('verify-twitter-oauth'),

  // RSS
  getRSSFeeds: () => ipcRenderer.invoke('get-rss-feeds'),
  addRSSFeed: (url: string, name: string, category: string) => ipcRenderer.invoke('add-rss-feed', url, name, category),
  removeRSSFeed: (url: string) => ipcRenderer.invoke('remove-rss-feed', url),
  fetchRSSFeeds: (feeds: { url: string; name: string; category: string }[]) => ipcRenderer.invoke('fetch-rss-feeds', feeds),

  // Claude API
  getClaudeApiKey: () => ipcRenderer.invoke('get-claude-api-key'),
  saveClaudeApiKey: (key: string) => ipcRenderer.invoke('save-claude-api-key', key),
  verifyClaudeKey: (key: string) => ipcRenderer.invoke('verify-claude-key', key),
  summarizeFeed: (apiKey: string, articles: { title: string; description: string }[], section: string) => ipcRenderer.invoke('summarize-feed', apiKey, articles, section),
  parseVoiceCommand: (apiKey: string, transcript: string, categoryNames: string[]) => ipcRenderer.invoke('parse-voice-command', apiKey, transcript, categoryNames),

  // Activity Log
  getActivityLog: (days?: number) => ipcRenderer.invoke('get-activity-log', days),

  // Pomodoro
  getPomodoroState: () => ipcRenderer.invoke('get-pomodoro-state'),
  startPomodoro: (taskId: number | null, taskTitle: string, durationMinutes?: number) => ipcRenderer.invoke('start-pomodoro', taskId, taskTitle, durationMinutes),
  completePomodoro: () => ipcRenderer.invoke('complete-pomodoro'),
  startBreak: (type: 'short_break' | 'long_break') => ipcRenderer.invoke('start-break', type),
  stopPomodoro: () => ipcRenderer.invoke('stop-pomodoro'),

  // Morning Briefing
  getMorningBriefing: (date: string) => ipcRenderer.invoke('get-morning-briefing', date),
  generateMorningBriefing: () => ipcRenderer.invoke('generate-morning-briefing'),
  dismissMorningBriefing: (date: string) => ipcRenderer.invoke('dismiss-morning-briefing', date),

  // Weekly Review
  getWeeklyReview: (weekStart: string) => ipcRenderer.invoke('get-weekly-review', weekStart),
  getAllWeeklyReviews: () => ipcRenderer.invoke('get-all-weekly-reviews'),
  generateWeeklyReview: (weekStart: string) => ipcRenderer.invoke('generate-weekly-review', weekStart),
  checkWeeklyReviewNeeded: () => ipcRenderer.invoke('check-weekly-review-needed'),

  // Notifications
  showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),

  // Open URL in browser
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Terminal
  createTerminal: (cols: number, rows: number) => ipcRenderer.invoke('create-terminal', cols, rows),
  writeTerminal: (data: string) => ipcRenderer.invoke('write-terminal', data),
  resizeTerminal: (cols: number, rows: number) => ipcRenderer.invoke('resize-terminal', cols, rows),
  killTerminal: () => ipcRenderer.invoke('kill-terminal'),
  onTerminalData: (callback: (data: string) => void) => {
    const handler = (_: any, data: string) => callback(data)
    ipcRenderer.on('terminal-data', handler)
    return () => { ipcRenderer.removeListener('terminal-data', handler) }
  },

  // Window controls
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  onOpenAddModal: (callback: () => void) => {
    ipcRenderer.on('open-add-modal', callback)
    return () => ipcRenderer.removeListener('open-add-modal', callback)
  }
})
