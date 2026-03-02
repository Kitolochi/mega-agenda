/**
 * Mock electronAPI for browser-based development/testing.
 * When the app runs outside Electron (e.g. localhost in a browser),
 * this provides stub responses so the UI renders without crashing.
 */

const noop = async () => {}
const emptyArray = async () => []
const noopUnsub = () => () => {}

const MOCK_CATEGORIES = [
  { id: 1, name: 'Work', color: '#8b5cf6', icon: '💼', sort_order: 0 },
  { id: 2, name: 'Personal', color: '#3b82f6', icon: '🏠', sort_order: 1 },
]

const MOCK_STATS = {
  currentStreak: 1,
  bestStreak: 5,
  lastStreakDate: new Date().toISOString().split('T')[0],
  tasksCompletedThisWeek: 3,
  weekStartDate: new Date().toISOString().split('T')[0],
}

export function installElectronMock() {
  if (window.electronAPI) return // Already in Electron, skip

  console.log('[DEV] Running in browser mode with mock electronAPI')

  window.electronAPI = {
    // Tasks
    getCategories: async () => MOCK_CATEGORIES,
    addCategory: async (name: string, color: string, icon: string) => ({ id: Date.now(), name, color, icon, sort_order: 0 }),
    deleteCategory: noop as any,
    getTasks: emptyArray as any,
    addTask: async (t: any) => ({ ...t, id: Date.now(), created_at: new Date().toISOString() }),
    updateTask: async (_id: number, u: any) => u,
    deleteTask: noop as any,
    toggleTask: async (id: number) => ({ id, completed: 1 }),

    // Notes
    getDailyNote: async () => null,
    saveDailyNote: async (date: string, content: string) => ({ date, content, updated_at: new Date().toISOString() }),
    getRecentNotes: emptyArray as any,

    // Stats
    getStats: async () => MOCK_STATS,

    // Twitter
    getTwitterSettings: async () => ({ bearerToken: '', username: '', userId: '', listIds: [], apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' }),
    saveTwitterSettings: async (s: any) => s,
    verifyTwitterToken: async () => ({ valid: false, error: 'Mock mode' }),
    twitterGetUser: async () => null,
    twitterGetLists: emptyArray as any,
    twitterFetchFeed: emptyArray as any,

    // RSS
    getRSSFeeds: emptyArray as any,
    addRSSFeed: emptyArray as any,
    removeRSSFeed: emptyArray as any,
    fetchRSSFeeds: emptyArray as any,

    // Claude/LLM
    getClaudeApiKey: async () => '',
    saveClaudeApiKey: async () => true,
    verifyClaudeKey: async () => ({ valid: false }),
    summarizeFeed: async () => 'Mock summary',
    parseVoiceCommand: async () => ({ action: 'unknown' as const }),
    getLLMSettings: async () => ({ provider: 'claude' as const, geminiApiKey: '', groqApiKey: '', openrouterApiKey: '', primaryModel: '', fastModel: '' }),
    saveLLMSettings: async (s: any) => s,
    verifyLLMKey: async () => ({ valid: false }),
    getProviderModels: async () => ({}),
    getProviderChatModels: async () => ({}),

    // Research
    researchRoadmapGoal: async () => ({ report: '', filePath: '' }),
    researchRoadmapTopic: async () => ({ report: '', generatedAt: '' }),
    generateActionPlan: async () => ({ report: '', generatedAt: '' }),
    generateTopics: async () => ({ added: { questions: 0, guidance: 0 }, total: { questions: 0, guidance: 0 } }),

    // Tweet posting
    postTweet: async () => ({ success: false, error: 'Mock mode' }),
    verifyTwitterOAuth: async () => ({ valid: false }),

    // Activity
    getActivityLog: emptyArray as any,

    // Pomodoro
    getPomodoroState: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    startPomodoro: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    completePomodoro: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    startBreak: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),
    stopPomodoro: async () => ({ isRunning: false, currentSession: null, sessionsCompleted: 0, totalSessionsToday: 0, todayDate: '' }),

    // Morning/Weekly
    getMorningBriefing: async () => null,
    generateMorningBriefing: async () => ({ date: '', content: '', isAiEnhanced: false, dismissed: false, generatedAt: '' }),
    dismissMorningBriefing: noop as any,
    getWeeklyReview: async () => null,
    getAllWeeklyReviews: emptyArray as any,
    generateWeeklyReview: async () => ({ weekStartDate: '', content: '', generatedAt: '', tasksCompletedCount: 0, categoriesWorked: [], streakAtGeneration: 0 }),
    checkWeeklyReviewNeeded: async () => ({ needed: false, weekStart: '' }),

    // Notifications
    showNotification: noop as any,

    // Terminal
    createTerminal: noop as any,
    writeTerminal: noop as any,
    resizeTerminal: noop as any,
    killTerminal: noop as any,
    onTerminalData: noopUnsub as any,

    // CLI
    getUseCliMode: async () => false,
    setUseCliMode: async () => false,
    checkCliAvailable: async () => ({ available: false, path: null }),

    // Clipboard
    readClipboard: () => '',
    writeClipboard: () => {},

    // Utilities
    openExternal: noop as any,

    // Window
    closeWindow: () => {},
    minimizeWindow: () => {},
    onOpenAddModal: noopUnsub as any,
    onTasksUpdated: noopUnsub as any,

    // Chat
    getChatConversations: emptyArray as any,
    getChatConversation: async () => null,
    createChatConversation: async (title: string) => ({ id: Date.now().toString(), title, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    addChatMessage: async () => null as any,
    deleteChatConversation: noop as any,
    renameChatConversation: async () => null as any,
    getChatSettings: async () => ({ model: '', systemPromptMode: 'default' as const, maxTokens: 4096 }),
    saveChatSettings: async (s: any) => s,

    // Chat streaming
    chatSendMessage: noop as any,
    chatAbort: noop as any,
    getMemoryCountForChat: async () => 0,
    onChatStreamChunk: noopUnsub as any,
    onChatStreamEnd: noopUnsub as any,
    onChatStreamError: noopUnsub as any,

    // CLI logs
    getCliSessions: emptyArray as any,
    getCliSessionMessages: async () => ({ messages: [], hasMore: false }),
    searchCliSessions: emptyArray as any,
    searchGitHubRepos: emptyArray as any,

    // Tweet drafts
    getTweetDrafts: emptyArray as any,
    getTweetDraft: async () => null,
    createTweetDraft: async () => ({ id: '', text: '', segments: [], isThread: false, status: 'draft' as const, aiHistory: [], createdAt: '', updatedAt: '', threadTweetIds: [] }),
    updateTweetDraft: async () => null,
    addTweetAIMessage: async () => null,
    deleteTweetDraft: noop as any,

    // Tweet AI
    tweetBrainstorm: async () => '',
    tweetBrainstormThread: async () => '',
    tweetRefine: async () => '',
    tweetAnalyze: async () => '',

    // Tweet Personas
    getTweetPersonas: emptyArray as any,
    createTweetPersona: async (p: any) => ({ ...p, id: Date.now().toString(), isBuiltIn: false, createdAt: new Date().toISOString() }),
    deleteTweetPersona: noop as any,

    // External terminal
    launchExternalTerminal: noop as any,

    // AI Tasks
    getAITasks: emptyArray as any,
    createAITask: async (t: any) => ({ ...t, id: Date.now().toString(), column: 'backlog', createdAt: '', updatedAt: '' }),
    updateAITask: async () => null,
    deleteAITask: noop as any,
    moveAITask: async () => null,

    // Roadmap
    getRoadmapGoals: emptyArray as any,
    createRoadmapGoal: async (g: any) => ({ ...g, id: Date.now().toString(), createdAt: '', updatedAt: '' }),
    updateRoadmapGoal: async () => null,
    deleteRoadmapGoal: noop as any,

    // Master Plan
    getMasterPlan: async () => null,
    generateMasterPlan: async () => ({ content: '', generatedAt: '', goalIds: [], metadata: { totalGoals: 0, goalsWithResearch: 0 } }),
    clearMasterPlan: noop as any,

    // Master Plan Execution
    generateContextQuestions: emptyArray as any,
    getMasterPlanTasks: emptyArray as any,
    updateMasterPlanTask: async () => null,
    launchDailyPlan: async () => ({ launched: 0, taskIds: [] }),
    pollTaskSessions: emptyArray as any,

    // Goal Action Plan
    extractGoalActionTasks: emptyArray as any,
    launchGoalTasks: async () => ({ launched: 0, taskIds: [] }),
    pollGoalTaskSessions: emptyArray as any,
    getGoalWorkspace: async () => null,
    getGoalDeliverables: emptyArray as any,
    getGoalGitLog: emptyArray as any,
    getGoalRepoInfo: async () => null,
    extractGoalLearnings: async () => ({ memoriesCreated: 0, memories: [] }),

    // Smart Query
    smartQuery: async () => ({ queryId: '' }),
    onSmartQueryChunk: noopUnsub as any,
    onSmartQueryEnd: noopUnsub as any,
    onSmartQueryError: noopUnsub as any,

    // Welcome
    isWelcomeDismissed: async () => true,
    dismissWelcome: noop as any,

    // Context Files
    getContextFiles: emptyArray as any,
    saveContextFile: async () => ({} as any),
    deleteContextFile: async () => true,
    createContextFolder: async () => true,
    deleteContextFolder: async () => true,
    uploadContextFiles: emptyArray as any,
    scaffoldDomainFolders: async () => true,

    // Whisper
    transcribeAudio: async () => '',
    transcribeAudioBlob: async () => '',
    getWhisperStatus: async () => ({ ready: false, loading: false, error: null, progress: 0 }),

    // Embeddings
    getEmbeddingStatus: async () => ({ ready: false, loading: false, error: null, progress: 0 }),
    rebuildVectorIndex: async () => ({ added: 0, removed: 0, total: 0 }),
    generateReorgPlan: async () => ({ items: [], summary: '' }),
    executeReorgPlan: async () => ({ success: true, backupPath: '' }),
    onEmbeddingProgress: noopUnsub as any,
    onIndexProgress: noopUnsub as any,

    // Knowledge Pack
    getKnowledgePacks: emptyArray as any,
    compressKnowledge: async () => ({ id: '', createdAt: '', overview: '', clusters: [], stats: { totalMemories: 0, totalContextFiles: 0, totalChunks: 0, totalFacts: 0, compressionRatio: 0, durationMs: 0 } }),
    auditCompression: async () => ({ coverageScore: 0, totalOriginalItems: 0, coveredItems: 0, uncoveredItems: [], clusterCoverage: [], duplicatesRemoved: 0 }),
    getMemoryHealth: async () => ({ totalMemories: 0, totalTokens: 0, tokenBudget: 50000, budgetUsagePercent: 0, status: 'healthy' as const, staleMemoryCount: 0, recommendation: '' }),
    autoPruneMemories: async () => 0,
    startHealthMonitor: noop as any,
    stopHealthMonitor: noop as any,
    onCompressionProgress: noopUnsub as any,
    onMemoryHealthUpdate: noopUnsub as any,

    // Lab tools
    compressSingleFile: async () => ({ fileName: '', originalSize: 0, originalText: '', chunks: 0, clusters: [], totalFacts: 0, overview: '', durationMs: 0 }),
    compressFolder: async () => ({ folder: '', fileCount: 0, filesUsed: [], clusters: [], overview: '', totalFacts: 0, dedupRemoved: 0, conflictsResolved: false, durationMs: 0 }),
    testEmbeddingSimilarity: async () => ({ similarity: 0, embeddingDim: 384 }),
    listContextFiles: async () => [
      { name: 'Daria/master_analysis.md', size: 27534, isStub: false, authority: 90 },
      { name: 'Daria/chris_perspective_corrections (1).md', size: 26714, isStub: false, authority: 85 },
      { name: 'Daria/FINAL_META_ANALYSIS.md', size: 27907, isStub: false, authority: 85 },
      { name: 'Daria/analysis_jan_feb_2026.md', size: 30398, isStub: false, authority: 70 },
      { name: 'Daria/analysis_dec_2025.md', size: 22935, isStub: false, authority: 70 },
      { name: 'Daria/analysis_nov_2025.md', size: 25214, isStub: false, authority: 70 },
      { name: 'Daria/analysis_oct_2025.md', size: 30351, isStub: false, authority: 69 },
      { name: 'Daria/analysis_aug_2025.md', size: 26032, isStub: false, authority: 68 },
      { name: 'patterns.md', size: 5926, isStub: false, authority: 65 },
      { name: 'Daria/Daria_psychology.md', size: 111764, isStub: false, authority: 65 },
      { name: 'Daria/analysis_sep_2025.md', size: 14256, isStub: false, authority: 64 },
      { name: 'learnings.md', size: 3058, isStub: false, authority: 60 },
      { name: 'decisions.md', size: 1432, isStub: false, authority: 60 },
      { name: 'projects.md', size: 2254, isStub: false, authority: 60 },
      { name: 'Daria/dynamics (1).md', size: 27147, isStub: false, authority: 60 },
      { name: 'Daria/analysis_early_mar_jul.md', size: 19972, isStub: false, authority: 56 },
      { name: 'Daria/notable_quotes_jul14-jul22_2025 (1).md', size: 8971, isStub: false, authority: 48 },
      { name: 'Daria/notable_quotes_jul22-aug3_2025 (1).md', size: 10364, isStub: false, authority: 48 },
      { name: 'Daria/notable_quotes_jun5-jul14_2025 (1).md', size: 10775, isStub: false, authority: 47 },
      { name: 'Daria/daily_log (1).md', size: 24505, isStub: false, authority: 45 },
    ],

    // Memory
    getMemories: emptyArray as any,
    createMemory: async (m: any) => ({ ...m, id: Date.now().toString(), createdAt: '', updatedAt: '' }),
    updateMemory: async () => null,
    deleteMemory: noop as any,
    archiveMemory: async () => null,
    pinMemory: async () => null,
    getMemoryTopics: emptyArray as any,
    updateMemoryTopics: emptyArray as any,
    getMemorySettings: async () => ({ autoGenerate: true, maxMemoriesInContext: 10, tokenBudget: 50000 }),
    saveMemorySettings: async (s: any) => s,
    extractMemoriesFromChat: emptyArray as any,
    extractMemoriesFromCli: emptyArray as any,
    extractMemoriesFromJournal: emptyArray as any,
    batchExtractMemories: emptyArray as any,

    // Bank Sync
    getBankConnections: emptyArray as any,
    connectBank: async () => ({} as any),
    deleteBankConnection: noop as any,
    syncBankConnection: async () => ({ accounts: [], transactions: 0 }),
    syncAllBankConnections: noop as any,
    getBankAccounts: emptyArray as any,
    getBankTransactions: emptyArray as any,
  } as any
}
