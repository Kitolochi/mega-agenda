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
  addCategory: (name: string, color: string, icon: string) => ipcRenderer.invoke('add-category', name, color, icon),
  deleteCategory: (id: number) => ipcRenderer.invoke('delete-category', id),
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
  postTweet: (text: string, replyToTweetId?: string) => ipcRenderer.invoke('post-tweet', text, replyToTweetId),
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

  // Chat conversations
  getChatConversations: () => ipcRenderer.invoke('get-chat-conversations'),
  getChatConversation: (id: string) => ipcRenderer.invoke('get-chat-conversation', id),
  createChatConversation: (title: string) => ipcRenderer.invoke('create-chat-conversation', title),
  addChatMessage: (conversationId: string, message: any) => ipcRenderer.invoke('add-chat-message', conversationId, message),
  deleteChatConversation: (id: string) => ipcRenderer.invoke('delete-chat-conversation', id),
  renameChatConversation: (id: string, title: string) => ipcRenderer.invoke('rename-chat-conversation', id, title),

  // Chat settings
  getChatSettings: () => ipcRenderer.invoke('get-chat-settings'),
  saveChatSettings: (settings: any) => ipcRenderer.invoke('save-chat-settings', settings),

  // Chat streaming
  chatSendMessage: (conversationId: string, messages: { role: string; content: string }[], systemPrompt?: string) =>
    ipcRenderer.invoke('chat-send-message', conversationId, messages, systemPrompt),
  chatAbort: () => ipcRenderer.invoke('chat-abort'),
  onChatStreamChunk: (callback: (data: { conversationId: string; text: string }) => void) => {
    const handler = (_: any, data: { conversationId: string; text: string }) => callback(data)
    ipcRenderer.on('chat-stream-chunk', handler)
    return () => { ipcRenderer.removeListener('chat-stream-chunk', handler) }
  },
  onChatStreamEnd: (callback: (data: { conversationId: string; model: string; usage: { input: number; output: number } }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('chat-stream-end', handler)
    return () => { ipcRenderer.removeListener('chat-stream-end', handler) }
  },
  onChatStreamError: (callback: (data: { conversationId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('chat-stream-error', handler)
    return () => { ipcRenderer.removeListener('chat-stream-error', handler) }
  },

  // CLI logs
  getCliSessions: () => ipcRenderer.invoke('get-cli-sessions'),
  getCliSessionMessages: (sessionId: string, offset?: number, limit?: number) =>
    ipcRenderer.invoke('get-cli-session-messages', sessionId, offset, limit),
  searchCliSessions: (query: string) => ipcRenderer.invoke('search-cli-sessions', query),
  searchGitHubRepos: (query: string) => ipcRenderer.invoke('search-github-repos', query),

  // Tweet drafts
  getTweetDrafts: () => ipcRenderer.invoke('get-tweet-drafts'),
  getTweetDraft: (id: string) => ipcRenderer.invoke('get-tweet-draft', id),
  createTweetDraft: (topic?: string) => ipcRenderer.invoke('create-tweet-draft', topic),
  updateTweetDraft: (id: string, updates: any) => ipcRenderer.invoke('update-tweet-draft', id, updates),
  addTweetAIMessage: (draftId: string, msg: any) => ipcRenderer.invoke('add-tweet-ai-message', draftId, msg),
  deleteTweetDraft: (id: string) => ipcRenderer.invoke('delete-tweet-draft', id),

  // Tweet AI
  tweetBrainstorm: (topic: string, history: { role: string; content: string }[], persona?: any) =>
    ipcRenderer.invoke('tweet-brainstorm', topic, history, persona),
  tweetBrainstormThread: (topic: string, history: { role: string; content: string }[], persona?: any) =>
    ipcRenderer.invoke('tweet-brainstorm-thread', topic, history, persona),
  tweetRefine: (text: string, instruction: string, history: { role: string; content: string }[], persona?: any) =>
    ipcRenderer.invoke('tweet-refine', text, instruction, history, persona),
  tweetAnalyze: (text: string) => ipcRenderer.invoke('tweet-analyze', text),

  // Tweet Personas
  getTweetPersonas: () => ipcRenderer.invoke('get-tweet-personas'),
  createTweetPersona: (persona: { name: string; description: string; exampleTweets: string[] }) =>
    ipcRenderer.invoke('create-tweet-persona', persona),
  deleteTweetPersona: (id: string) => ipcRenderer.invoke('delete-tweet-persona', id),

  // AI Tasks
  getAITasks: () => ipcRenderer.invoke('get-ai-tasks'),
  createAITask: (task: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }) =>
    ipcRenderer.invoke('create-ai-task', task),
  updateAITask: (id: string, updates: any) => ipcRenderer.invoke('update-ai-task', id, updates),
  deleteAITask: (id: string) => ipcRenderer.invoke('delete-ai-task', id),
  moveAITask: (id: string, column: string) => ipcRenderer.invoke('move-ai-task', id, column),

  // Clipboard
  readClipboard: () => ipcRenderer.sendSync('read-clipboard'),
  writeClipboard: (text: string) => ipcRenderer.send('write-clipboard', text),

  // Window controls
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  onOpenAddModal: (callback: () => void) => {
    ipcRenderer.on('open-add-modal', callback)
    return () => ipcRenderer.removeListener('open-add-modal', callback)
  },
  onTasksUpdated: (callback: () => void) => {
    ipcRenderer.on('tasks-updated', callback)
    return () => ipcRenderer.removeListener('tasks-updated', callback)
  }
})
