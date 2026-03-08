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
  onResearchProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('research-progress', handler)
    return () => { ipcRenderer.removeListener('research-progress', handler) }
  },
  cancelResearch: () => ipcRenderer.invoke('cancel-research'),
  researchRoadmapTopic: (goalId: string, topicIndex: number, topicType: 'question' | 'guidance') =>
    ipcRenderer.invoke('research-roadmap-topic', goalId, topicIndex, topicType),
  generateActionPlan: (goalId: string) => ipcRenderer.invoke('generate-action-plan', goalId),
  generateTopics: (goalId: string, direction?: string) => ipcRenderer.invoke('generate-topics', goalId, direction),
  removeTopicReport: (goalId: string, topic: string, topicType: string) => ipcRenderer.invoke('remove-topic-report', goalId, topic, topicType),
  purgeStubReports: (goalId: string) => ipcRenderer.invoke('purge-stub-reports', goalId),
  categorizeGoalTopics: (goalId: string) => ipcRenderer.invoke('categorize-goal-topics', goalId),

  // Activity Log
  getActivityLog: (days?: number) => ipcRenderer.invoke('get-activity-log', days),

  // Pomodoro
  getPomodoroState: () => ipcRenderer.invoke('get-pomodoro-state'),
  startPomodoro: (taskId: number | null, taskTitle: string, durationMinutes?: number) => ipcRenderer.invoke('start-pomodoro', taskId, taskTitle, durationMinutes),
  completePomodoro: () => ipcRenderer.invoke('complete-pomodoro'),
  startBreak: (type: 'short_break' | 'long_break') => ipcRenderer.invoke('start-break', type),
  stopPomodoro: () => ipcRenderer.invoke('stop-pomodoro'),
  savePomodoroSession: (record: any) => ipcRenderer.invoke('save-pomodoro-session', record),
  getPomodoroStats: () => ipcRenderer.invoke('get-pomodoro-stats'),

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
  compressFolder: (folder: string) => ipcRenderer.invoke('compress-folder', folder),
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

  // Network CRM
  getNetworkContacts: () => ipcRenderer.invoke('get-network-contacts'),
  getNetworkContact: (id: string) => ipcRenderer.invoke('get-network-contact', id),
  createNetworkContact: (data: any) => ipcRenderer.invoke('create-network-contact', data),
  updateNetworkContact: (id: string, updates: any) => ipcRenderer.invoke('update-network-contact', id, updates),
  deleteNetworkContact: (id: string) => ipcRenderer.invoke('delete-network-contact', id),
  getContactInteractions: (contactId?: string) => ipcRenderer.invoke('get-contact-interactions', contactId),
  createContactInteraction: (data: any) => ipcRenderer.invoke('create-contact-interaction', data),
  deleteContactInteraction: (id: string) => ipcRenderer.invoke('delete-contact-interaction', id),
  getPipelines: () => ipcRenderer.invoke('get-pipelines'),
  createPipeline: (data: any) => ipcRenderer.invoke('create-pipeline', data),
  updatePipeline: (id: string, updates: any) => ipcRenderer.invoke('update-pipeline', id, updates),
  deletePipeline: (id: string) => ipcRenderer.invoke('delete-pipeline', id),
  getPipelineCards: (pipelineId?: string) => ipcRenderer.invoke('get-pipeline-cards', pipelineId),
  createPipelineCard: (data: any) => ipcRenderer.invoke('create-pipeline-card', data),
  updatePipelineCard: (id: string, updates: any) => ipcRenderer.invoke('update-pipeline-card', id, updates),
  movePipelineCard: (id: string, stage: string) => ipcRenderer.invoke('move-pipeline-card', id, stage),
  deletePipelineCard: (id: string) => ipcRenderer.invoke('delete-pipeline-card', id),

  // Social Connectors
  getSocialConnections: () => ipcRenderer.invoke('social-get-connections'),
  connectSocialProvider: (provider: string, credentials: any) => ipcRenderer.invoke('social-connect-provider', provider, credentials),
  disconnectSocialProvider: (connectionId: string) => ipcRenderer.invoke('social-disconnect-provider', connectionId),
  deleteSocialConnection: (connectionId: string) => ipcRenderer.invoke('social-delete-connection', connectionId),
  syncSocialProvider: (connectionId: string) => ipcRenderer.invoke('social-sync-provider', connectionId),
  getContactMappings: (contactId?: string) => ipcRenderer.invoke('social-get-contact-mappings', contactId),
  deleteContactMapping: (id: string) => ipcRenderer.invoke('social-delete-contact-mapping', id),
  telegramSendCode: (phone: string, apiId: number, apiHash: string) => ipcRenderer.invoke('social-telegram-send-code', phone, apiId, apiHash),
  telegramVerifyCode: (phone: string, code: string, phoneCodeHash: string, apiId: number, apiHash: string) => ipcRenderer.invoke('social-telegram-verify-code', phone, code, phoneCodeHash, apiId, apiHash),
  smsDetectDb: () => ipcRenderer.invoke('social-sms-detect-db'),
  getSocialSyncStatus: (connectionId: string) => ipcRenderer.invoke('social-get-sync-status', connectionId),
  twitterSyncContacts: () => ipcRenderer.invoke('social-twitter-sync-contacts'),

  // Content Writer
  getContentDrafts: () => ipcRenderer.invoke('get-content-drafts'),
  getContentDraft: (id: string) => ipcRenderer.invoke('get-content-draft', id),
  createContentDraft: (topic?: string) => ipcRenderer.invoke('create-content-draft', topic),
  updateContentDraft: (id: string, updates: any) => ipcRenderer.invoke('update-content-draft', id, updates),
  deleteContentDraft: (id: string) => ipcRenderer.invoke('delete-content-draft', id),
  contentResearch: (draftId: string, topic: string) => ipcRenderer.invoke('content-research', draftId, topic),
  contentResearchAbort: () => ipcRenderer.invoke('content-research-abort'),
  contentGenerate: (draftId: string, messages: { role: string; content: string }[], contentType: string) =>
    ipcRenderer.invoke('content-generate', draftId, messages, contentType),
  contentAbort: () => ipcRenderer.invoke('content-abort'),
  onContentResearchChunk: (callback: (data: { draftId: string; text: string }) => void) => {
    const handler = (_: any, data: { draftId: string; text: string }) => callback(data)
    ipcRenderer.on('content-research-chunk', handler)
    return () => { ipcRenderer.removeListener('content-research-chunk', handler) }
  },
  onContentResearchEnd: (callback: (data: { draftId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-research-end', handler)
    return () => { ipcRenderer.removeListener('content-research-end', handler) }
  },
  onContentResearchError: (callback: (data: { draftId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-research-error', handler)
    return () => { ipcRenderer.removeListener('content-research-error', handler) }
  },
  onContentStreamChunk: (callback: (data: { draftId: string; text: string }) => void) => {
    const handler = (_: any, data: { draftId: string; text: string }) => callback(data)
    ipcRenderer.on('content-stream-chunk', handler)
    return () => { ipcRenderer.removeListener('content-stream-chunk', handler) }
  },
  onContentStreamEnd: (callback: (data: { draftId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-stream-end', handler)
    return () => { ipcRenderer.removeListener('content-stream-end', handler) }
  },
  onContentStreamError: (callback: (data: { draftId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-stream-error', handler)
    return () => { ipcRenderer.removeListener('content-stream-error', handler) }
  },
  onContentScoresReady: (callback: (data: { draftId: string; scores: any[] }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-scores-ready', handler)
    return () => { ipcRenderer.removeListener('content-scores-ready', handler) }
  },
  onContentScoresError: (callback: (data: { draftId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-scores-error', handler)
    return () => { ipcRenderer.removeListener('content-scores-error', handler) }
  },
  getScoreSnapshots: () => ipcRenderer.invoke('get-score-snapshots'),
  getTweetPatterns: () => ipcRenderer.invoke('get-tweet-patterns'),
  extractTweetPatterns: () => ipcRenderer.invoke('extract-tweet-patterns'),
  getSessionInsights: () => ipcRenderer.invoke('get-session-insights'),
  importSessionTweet: (text: string, topic: string) => ipcRenderer.invoke('import-session-tweet', text, topic),
  onContentAutoRefineStart: (callback: (data: { draftId: string; weakCount: number; avgScore: number }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('content-auto-refine-start', handler)
    return () => { ipcRenderer.removeListener('content-auto-refine-start', handler) }
  },

  // Bank Sync
  getBankConnections: () => ipcRenderer.invoke('get-bank-connections'),
  connectBank: (provider: 'simplefin' | 'teller', token: string) => ipcRenderer.invoke('connect-bank', provider, token),
  deleteBankConnection: (id: string) => ipcRenderer.invoke('delete-bank-connection', id),
  syncBankConnection: (id: string) => ipcRenderer.invoke('sync-bank-connection', id),
  syncAllBankConnections: () => ipcRenderer.invoke('sync-all-bank-connections'),
  getBankAccounts: () => ipcRenderer.invoke('get-bank-accounts'),
  getBankTransactions: (accountId?: string, limit?: number) => ipcRenderer.invoke('get-bank-transactions', accountId, limit),
  getCategoryOverrides: () => ipcRenderer.invoke('get-category-overrides'),
  setCategoryOverride: (transactionId: string, categoryKey: string) => ipcRenderer.invoke('set-category-override', transactionId, categoryKey),
  removeCategoryOverride: (transactionId: string) => ipcRenderer.invoke('remove-category-override', transactionId),

  // Outreach Settings
  getOutreachSettings: () => ipcRenderer.invoke('get-outreach-settings'),
  setOutreachSetting: (key: string, value: string) => ipcRenderer.invoke('set-outreach-setting', key, value),
  validateApiKey: (keyType: 'google_places' | 'apollo', apiKey: string) => ipcRenderer.invoke('validate-api-key', keyType, apiKey),
  runSeedDiscovery: () => ipcRenderer.invoke('run-seed-discovery'),
  getOutreachBusinessCount: () => ipcRenderer.invoke('get-outreach-business-count'),
  onSeedProgress: (callback: (data: { category: string; categoryIndex: number; totalCategories: number; imported: number; totalImported: number }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('seed-progress', handler)
    return () => { ipcRenderer.removeListener('seed-progress', handler) }
  },

  // Auto-Research
  runAutoResearch: () => ipcRenderer.invoke('run-auto-research'),
  onAutoResearchProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('auto-research-progress', handler)
    return () => { ipcRenderer.removeListener('auto-research-progress', handler) }
  },

  // Outreach
  searchBusinesses: (query: string, location?: string) => ipcRenderer.invoke('search-businesses', query, location),
  scrapeBusinesses: (urls: string[]) => ipcRenderer.invoke('scrape-businesses', urls),
  getBusinesses: (filters?: any) => ipcRenderer.invoke('get-businesses', filters),
  getBusiness: (id: string) => ipcRenderer.invoke('get-business', id),
  importBusinesses: (businesses: any[]) => ipcRenderer.invoke('import-businesses', businesses),
  updateBusiness: (id: string, updates: any) => ipcRenderer.invoke('update-business', id, updates),
  deleteBusiness: (id: string) => ipcRenderer.invoke('delete-business', id),
  enrichBusiness: (id: string) => ipcRenderer.invoke('enrich-business', id),
  getBusinessContacts: (businessId: string) => ipcRenderer.invoke('get-business-contacts', businessId),
  createContact: (data: any) => ipcRenderer.invoke('create-contact', data),
  getOutreachHistory: (businessId: string) => ipcRenderer.invoke('get-outreach-history', businessId),
  createOutreach: (data: any) => ipcRenderer.invoke('create-outreach', data),
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  createTemplate: (data: any) => ipcRenderer.invoke('create-template', data),
  updateTemplate: (id: string, updates: any) => ipcRenderer.invoke('update-template', id, updates),
  deleteTemplate: (id: string) => ipcRenderer.invoke('delete-template', id),
  generateMessage: (templateId: string, businessId: string, options?: any) => ipcRenderer.invoke('generate-message', templateId, businessId, options),
  generateBatchMessages: (businessIds: string[], templateId: string, options?: any) => ipcRenderer.invoke('generate-batch-messages', businessIds, templateId, options),
  getOutreachPipelineStats: () => ipcRenderer.invoke('get-pipeline-stats'),
  updateOutreach: (id: string, updates: any) => ipcRenderer.invoke('update-outreach', id, updates),

  // Google Workspace CLI
  gwsCheckAuth: () => ipcRenderer.invoke('gws-check-auth'),
  gwsSendEmail: (params: { outreachId?: string; businessId: string; to: string; subject: string; body: string }) =>
    ipcRenderer.invoke('gws-send-email', params),
  gwsCreateEvent: (params: { businessId: string; summary: string; startDateTime: string; endDateTime: string; attendeeEmail?: string; description?: string }) =>
    ipcRenderer.invoke('gws-create-event', params),
  gwsExportSheets: () => ipcRenderer.invoke('gws-export-sheets'),
  gwsUploadDrive: (params: { format: 'csv' | 'json' }) => ipcRenderer.invoke('gws-upload-drive', params),

  onBatchMessageProgress: (callback: (data: { current: number; total: number; businessName: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('batch-message-progress', handler)
    return () => { ipcRenderer.removeListener('batch-message-progress', handler) }
  },

  // Calendar
  getCalendarEvents: (startDate: string, endDate: string) => ipcRenderer.invoke('get-calendar-events', startDate, endDate),
  getDailyAgenda: (date: string) => ipcRenderer.invoke('get-daily-agenda', date),
  createCalendarEvent: (data: any) => ipcRenderer.invoke('create-calendar-event', data),
  updateCalendarEvent: (id: string, updates: any) => ipcRenderer.invoke('update-calendar-event', id, updates),
  deleteCalendarEvent: (id: string) => ipcRenderer.invoke('delete-calendar-event', id),
  getCalendarHistory: (query?: string, limit?: number) => ipcRenderer.invoke('get-calendar-history', query, limit),
  syncGcalEvents: () => ipcRenderer.invoke('sync-gcal-events'),
  fireDailyNotification: () => ipcRenderer.invoke('fire-daily-notification'),

  // Routines
  getRoutines: () => ipcRenderer.invoke('get-routines'),
  getRoutine: (id: string) => ipcRenderer.invoke('get-routine', id),
  createRoutine: (data: any) => ipcRenderer.invoke('create-routine', data),
  updateRoutine: (id: string, updates: any) => ipcRenderer.invoke('update-routine', id, updates),
  deleteRoutine: (id: string) => ipcRenderer.invoke('delete-routine', id),
  runRoutine: (id: string) => ipcRenderer.invoke('run-routine', id),
  getRoutineResults: (routineId?: string, date?: string, limit?: number) => ipcRenderer.invoke('get-routine-results', routineId, date, limit),
  getRoutineResultsForDate: (date: string) => ipcRenderer.invoke('get-routine-results-for-date', date),
  deleteRoutineResult: (id: string) => ipcRenderer.invoke('delete-routine-result', id),
  onRoutinesUpdated: (callback: () => void) => {
    ipcRenderer.on('routines-updated', callback)
    return () => ipcRenderer.removeListener('routines-updated', callback)
  },

  // Agents
  getAgents: () => ipcRenderer.invoke('get-agents'),
  getAgent: (id: string) => ipcRenderer.invoke('get-agent', id),
  createAgent: (data: any) => ipcRenderer.invoke('create-agent', data),
  updateAgent: (id: string, updates: any) => ipcRenderer.invoke('update-agent', id, updates),
  deleteAgent: (id: string) => ipcRenderer.invoke('delete-agent', id),
  setAgentStatus: (id: string, status: string, lastError?: string) => ipcRenderer.invoke('set-agent-status', id, status, lastError),
  getAgentIssues: (filters?: any) => ipcRenderer.invoke('get-agent-issues', filters),
  getAgentIssue: (id: string) => ipcRenderer.invoke('get-agent-issue', id),
  createAgentIssue: (data: any) => ipcRenderer.invoke('create-agent-issue', data),
  updateAgentIssue: (id: string, updates: any) => ipcRenderer.invoke('update-agent-issue', id, updates),
  deleteAgentIssue: (id: string) => ipcRenderer.invoke('delete-agent-issue', id),
  getHeartbeatRuns: (filters?: any) => ipcRenderer.invoke('get-heartbeat-runs', filters),
  runAgentHeartbeat: (agentId: string, issueId?: string) => ipcRenderer.invoke('run-agent-heartbeat', agentId, issueId),
  completeHeartbeatRun: (runId: string, updates: any) => ipcRenderer.invoke('complete-heartbeat-run', runId, updates),
  getCostEvents: (filters?: any) => ipcRenderer.invoke('get-cost-events', filters),
  getAgentCostSummary: (agentId: string) => ipcRenderer.invoke('get-agent-cost-summary', agentId),
  pollAgentSessions: () => ipcRenderer.invoke('poll-agent-sessions'),
  onAgentsUpdated: (callback: () => void) => {
    ipcRenderer.on('agents-updated', callback)
    return () => ipcRenderer.removeListener('agents-updated', callback)
  },

  // AgentsView Analytics
  avPing: () => ipcRenderer.invoke('av-ping'),
  avGetStats: () => ipcRenderer.invoke('av-get-stats'),
  avGetSummary: (days?: number) => ipcRenderer.invoke('av-get-summary', days),
  avGetTools: (days?: number) => ipcRenderer.invoke('av-get-tools', days),
  avGetVelocity: (days?: number) => ipcRenderer.invoke('av-get-velocity', days),
  avGetHeatmap: () => ipcRenderer.invoke('av-get-heatmap'),
  avGetProjects: () => ipcRenderer.invoke('av-get-projects'),
  avGetSessions: () => ipcRenderer.invoke('av-get-sessions'),
  avGetTopSessions: () => ipcRenderer.invoke('av-get-top-sessions'),
  avGetSessionList: (opts?: { limit?: number; project?: string; search?: string }) => ipcRenderer.invoke('av-get-session-list', opts),
  avGetSessionDetail: (id: string) => ipcRenderer.invoke('av-get-session-detail', id),
  avGetSessionMessages: (id: string, limit?: number) => ipcRenderer.invoke('av-get-session-messages', id, limit),
  avGetInsights: () => ipcRenderer.invoke('av-get-insights'),
  avGetSyncStatus: () => ipcRenderer.invoke('av-get-sync-status'),
  avSync: (full?: boolean) => ipcRenderer.invoke('av-sync', full),
  avGenerateInsights: (type: string, dateFrom: string, dateTo: string) => ipcRenderer.invoke('av-generate-insights', type, dateFrom, dateTo),

  // Guide Chat
  guideChatSend: (messages: { role: string; content: string }[]) => ipcRenderer.invoke('guide-chat-send', messages),
  guideChatAbort: () => ipcRenderer.invoke('guide-chat-abort'),
  onGuideChatChunk: (callback: (data: { text: string }) => void) => {
    const handler = (_: any, data: { text: string }) => callback(data)
    ipcRenderer.on('guide-chat-chunk', handler)
    return () => { ipcRenderer.removeListener('guide-chat-chunk', handler) }
  },
  onGuideChatEnd: (callback: (data: { model: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('guide-chat-end', handler)
    return () => { ipcRenderer.removeListener('guide-chat-end', handler) }
  },
  onGuideChatError: (callback: (data: { error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('guide-chat-error', handler)
    return () => { ipcRenderer.removeListener('guide-chat-error', handler) }
  },

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
