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

  // Research
  researchRoadmapGoal: (goalId: string) => ipcRenderer.invoke('research-roadmap-goal', goalId),
  researchRoadmapTopic: (goalId: string, topicIndex: number, topicType: 'question' | 'guidance') =>
    ipcRenderer.invoke('research-roadmap-topic', goalId, topicIndex, topicType),
  generateActionPlan: (goalId: string) => ipcRenderer.invoke('generate-action-plan', goalId),
  generateTopics: (goalId: string) => ipcRenderer.invoke('generate-topics', goalId),

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

  // CLI Mode
  getUseCliMode: () => ipcRenderer.invoke('get-use-cli-mode'),
  setUseCliMode: (enabled: boolean) => ipcRenderer.invoke('set-use-cli-mode', enabled),
  checkCliAvailable: () => ipcRenderer.invoke('check-cli-available'),

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

  // LLM Settings
  getLLMSettings: () => ipcRenderer.invoke('get-llm-settings'),
  saveLLMSettings: (settings: any) => ipcRenderer.invoke('save-llm-settings', settings),
  verifyLLMKey: (provider: string, key: string) => ipcRenderer.invoke('verify-llm-key', provider, key),
  getProviderModels: () => ipcRenderer.invoke('get-provider-models'),
  getProviderChatModels: () => ipcRenderer.invoke('get-provider-chat-models'),

  // Chat streaming
  chatSendMessage: (conversationId: string, messages: { role: string; content: string }[], systemPrompt?: string) =>
    ipcRenderer.invoke('chat-send-message', conversationId, messages, systemPrompt),
  chatAbort: () => ipcRenderer.invoke('chat-abort'),
  getMemoryCountForChat: (messages: { role: string; content: string }[]) => ipcRenderer.invoke('get-memory-count-for-chat', messages),
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

  // Launch external terminal
  launchExternalTerminal: (prompt: string, cwd?: string) =>
    ipcRenderer.invoke('launch-external-terminal', prompt, cwd),

  // Roadmap Goals
  getRoadmapGoals: () => ipcRenderer.invoke('get-roadmap-goals'),
  createRoadmapGoal: (goal: any) => ipcRenderer.invoke('create-roadmap-goal', goal),
  updateRoadmapGoal: (id: string, updates: any) => ipcRenderer.invoke('update-roadmap-goal', id, updates),
  deleteRoadmapGoal: (id: string) => ipcRenderer.invoke('delete-roadmap-goal', id),

  // Master Plan
  getMasterPlan: () => ipcRenderer.invoke('get-master-plan'),
  generateMasterPlan: () => ipcRenderer.invoke('generate-master-plan'),
  clearMasterPlan: () => ipcRenderer.invoke('clear-master-plan'),

  // Master Plan Execution
  generateContextQuestions: () => ipcRenderer.invoke('generate-context-questions'),
  getMasterPlanTasks: (planDate?: string) => ipcRenderer.invoke('get-master-plan-tasks', planDate),
  updateMasterPlanTask: (id: string, updates: any) => ipcRenderer.invoke('update-master-plan-task', id, updates),
  launchDailyPlan: (taskIds?: string[]) => ipcRenderer.invoke('launch-daily-plan', taskIds),
  pollTaskSessions: () => ipcRenderer.invoke('poll-task-sessions'),

  // Goal Action Plan Execution
  extractGoalActionTasks: (goalId: string) => ipcRenderer.invoke('extract-goal-action-tasks', goalId),
  launchGoalTasks: (goalId: string, taskIds?: string[]) => ipcRenderer.invoke('launch-goal-tasks', goalId, taskIds),
  pollGoalTaskSessions: (goalId: string) => ipcRenderer.invoke('poll-goal-task-sessions', goalId),
  getGoalWorkspace: (goalId: string) => ipcRenderer.invoke('get-goal-workspace', goalId),
  getGoalDeliverables: (goalId: string) => ipcRenderer.invoke('get-goal-deliverables', goalId),
  getGoalGitLog: (goalId: string) => ipcRenderer.invoke('get-goal-git-log', goalId),
  getGoalRepoInfo: (goalId: string) => ipcRenderer.invoke('get-goal-repo-info', goalId),
  extractGoalLearnings: (goalId: string) => ipcRenderer.invoke('extract-goal-learnings', goalId),

  // Smart Query
  smartQuery: (query: string) => ipcRenderer.invoke('smart-query', query),
  onSmartQueryChunk: (callback: (data: { queryId: string; text: string }) => void) => {
    const handler = (_: any, data: { queryId: string; text: string }) => callback(data)
    ipcRenderer.on('smart-query-chunk', handler)
    return () => { ipcRenderer.removeListener('smart-query-chunk', handler) }
  },
  onSmartQueryEnd: (callback: (data: { queryId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('smart-query-end', handler)
    return () => { ipcRenderer.removeListener('smart-query-end', handler) }
  },
  onSmartQueryError: (callback: (data: { queryId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('smart-query-error', handler)
    return () => { ipcRenderer.removeListener('smart-query-error', handler) }
  },

  // Welcome modal
  isWelcomeDismissed: () => ipcRenderer.invoke('is-welcome-dismissed'),
  dismissWelcome: () => ipcRenderer.invoke('dismiss-welcome'),

  // AI Tasks
  getAITasks: () => ipcRenderer.invoke('get-ai-tasks'),
  createAITask: (task: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }) =>
    ipcRenderer.invoke('create-ai-task', task),
  updateAITask: (id: string, updates: any) => ipcRenderer.invoke('update-ai-task', id, updates),
  deleteAITask: (id: string) => ipcRenderer.invoke('delete-ai-task', id),
  moveAITask: (id: string, column: string) => ipcRenderer.invoke('move-ai-task', id, column),

  // Whisper (local voice transcription)
  transcribeAudio: (audioData: number[]) => ipcRenderer.invoke('transcribe-audio', audioData),
  transcribeAudioBlob: (webmData: number[]) => ipcRenderer.invoke('transcribe-audio-blob', webmData),
  getWhisperStatus: () => ipcRenderer.invoke('get-whisper-status'),

  // RAG / Embeddings
  getEmbeddingStatus: () => ipcRenderer.invoke('get-embedding-status'),
  rebuildVectorIndex: () => ipcRenderer.invoke('rebuild-vector-index'),
  generateReorgPlan: () => ipcRenderer.invoke('generate-reorg-plan'),
  executeReorgPlan: (plan: any) => ipcRenderer.invoke('execute-reorg-plan', plan),
  onEmbeddingProgress: (callback: (progress: number) => void) => {
    const handler = (_: any, progress: number) => callback(progress)
    ipcRenderer.on('embedding-progress', handler)
    return () => { ipcRenderer.removeListener('embedding-progress', handler) }
  },
  onIndexProgress: (callback: (info: { phase: string; current: number; total: number }) => void) => {
    const handler = (_: any, info: any) => callback(info)
    ipcRenderer.on('index-progress', handler)
    return () => { ipcRenderer.removeListener('index-progress', handler) }
  },

  // Context Files
  getContextFiles: () => ipcRenderer.invoke('get-context-files'),
  saveContextFile: (name: string, content: string, folder?: string) => ipcRenderer.invoke('save-context-file', name, content, folder || ''),
  deleteContextFile: (name: string) => ipcRenderer.invoke('delete-context-file', name),
  createContextFolder: (relativePath: string) => ipcRenderer.invoke('create-context-folder', relativePath),
  deleteContextFolder: (relativePath: string) => ipcRenderer.invoke('delete-context-folder', relativePath),
  uploadContextFiles: (targetFolder: string) => ipcRenderer.invoke('upload-context-files', targetFolder),
  scaffoldDomainFolders: () => ipcRenderer.invoke('scaffold-domain-folders'),

  // Memory
  getMemories: () => ipcRenderer.invoke('get-memories'),
  createMemory: (memory: any) => ipcRenderer.invoke('create-memory', memory),
  updateMemory: (id: string, updates: any) => ipcRenderer.invoke('update-memory', id, updates),
  deleteMemory: (id: string) => ipcRenderer.invoke('delete-memory', id),
  archiveMemory: (id: string) => ipcRenderer.invoke('archive-memory', id),
  pinMemory: (id: string) => ipcRenderer.invoke('pin-memory', id),
  getMemoryTopics: () => ipcRenderer.invoke('get-memory-topics'),
  updateMemoryTopics: (topics: any[]) => ipcRenderer.invoke('update-memory-topics', topics),
  getMemorySettings: () => ipcRenderer.invoke('get-memory-settings'),
  saveMemorySettings: (settings: any) => ipcRenderer.invoke('save-memory-settings', settings),
  extractMemoriesFromChat: (conversationId: string) => ipcRenderer.invoke('extract-memories-from-chat', conversationId),
  extractMemoriesFromCli: (sessionId: string) => ipcRenderer.invoke('extract-memories-from-cli', sessionId),
  extractMemoriesFromJournal: (date: string) => ipcRenderer.invoke('extract-memories-from-journal', date),
  batchExtractMemories: () => ipcRenderer.invoke('batch-extract-memories'),

  // Knowledge Pack
  getKnowledgePacks: () => ipcRenderer.invoke('get-knowledge-packs'),
  compressKnowledge: () => ipcRenderer.invoke('compress-knowledge'),
  auditCompression: () => ipcRenderer.invoke('audit-compression'),

  // Lab tools
  compressSingleFile: (relativePath: string) => ipcRenderer.invoke('compress-single-file', relativePath),
  testEmbeddingSimilarity: (textA: string, textB: string) => ipcRenderer.invoke('test-embedding-similarity', textA, textB),
  listContextFiles: () => ipcRenderer.invoke('list-context-files'),
  getMemoryHealth: () => ipcRenderer.invoke('get-memory-health'),
  autoPruneMemories: () => ipcRenderer.invoke('auto-prune-memories'),
  startHealthMonitor: (intervalMs: number) => ipcRenderer.invoke('start-health-monitor', intervalMs),
  stopHealthMonitor: () => ipcRenderer.invoke('stop-health-monitor'),
  onCompressionProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('compression-progress', handler)
    return () => { ipcRenderer.removeListener('compression-progress', handler) }
  },
  onMemoryHealthUpdate: (callback: (health: any) => void) => {
    const handler = (_: any, health: any) => callback(health)
    ipcRenderer.on('memory-health-update', handler)
    return () => { ipcRenderer.removeListener('memory-health-update', handler) }
  },

  // Bank Sync
  getBankConnections: () => ipcRenderer.invoke('get-bank-connections'),
  connectBank: (provider: 'simplefin' | 'teller', token: string) => ipcRenderer.invoke('connect-bank', provider, token),
  deleteBankConnection: (id: string) => ipcRenderer.invoke('delete-bank-connection', id),
  syncBankConnection: (id: string) => ipcRenderer.invoke('sync-bank-connection', id),
  syncAllBankConnections: () => ipcRenderer.invoke('sync-all-bank-connections'),
  getBankAccounts: () => ipcRenderer.invoke('get-bank-accounts'),
  getBankTransactions: (accountId?: string, limit?: number) => ipcRenderer.invoke('get-bank-transactions', accountId, limit),

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
