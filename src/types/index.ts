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

export type LLMProvider = 'claude' | 'gemini' | 'groq' | 'openrouter'

export interface LLMSettings {
  provider: LLMProvider
  geminiApiKey: string
  groqApiKey: string
  openrouterApiKey: string
  primaryModel: string
  fastModel: string
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

export interface TweetAIMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'brainstorm' | 'refine' | 'analyze' | 'freeform'
  content: string
  timestamp: string
}

export interface TweetDraft {
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

export interface TweetPersona {
  id: string
  name: string
  description: string
  exampleTweets: string[]
  isBuiltIn: boolean
  createdAt: string
}

export interface GitHubRepoResult {
  name: string
  fullName: string
  description: string
  url: string
  localPath: string | null
  language: string
  updatedAt: string
}

export interface AITask {
  id: string
  title: string
  description: string
  column: 'backlog' | 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Memory {
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

export interface MemoryTopic {
  name: string
  color: string
  memoryCount: number
}

export interface MemorySettings {
  autoGenerate: boolean
  maxMemoriesInContext: number
  tokenBudget: number
}

export interface EmbeddingStatus {
  ready: boolean
  loading: boolean
  error: string | null
  progress: number
}

export interface WhisperStatus {
  ready: boolean
  loading: boolean
  error: string | null
  progress: number
}

export interface ReorgPlanItem {
  action: 'move' | 'merge' | 'delete'
  source: string
  destination?: string
  reason: string
}

export interface ReorgPlan {
  items: ReorgPlanItem[]
  summary: string
  backupPath?: string
}

export interface MasterPlan {
  content: string
  generatedAt: string
  goalIds: string[]
  metadata: {
    totalGoals: number
    goalsWithResearch: number
  }
}

export type AgentTaskType = 'research' | 'code' | 'writing' | 'planning' | 'communication'

export interface MasterPlanTask {
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
  taskType?: AgentTaskType
  createdAt: string
  planDate: string
}

export interface GitLogEntry {
  hash: string
  message: string
  date: string
  author: string
}

export interface ContextFile {
  name: string       // e.g. "learnings.md" or "data.json"
  path: string       // full path
  content: string    // file content (empty string for binary)
  modifiedAt: string // ISO timestamp
  folder: string     // relative folder path from root, e.g. "" or "research/ai"
  isDirectory: boolean // true if this entry is a folder
  size: number       // file size in bytes
}

export type RoadmapGoalCategory = 'career' | 'health' | 'financial' | 'relationships' | 'learning' | 'projects' | 'personal' | 'creative'
export type RoadmapGoalStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold'

export interface TopicReport {
  topic: string
  type: 'question' | 'guidance'
  report: string
  generatedAt: string
}

export interface RoadmapSubGoal {
  id: string
  title: string
  status: RoadmapGoalStatus
  notes?: string
}

export interface RoadmapGoal {
  id: string
  title: string
  description: string
  category: RoadmapGoalCategory
  targetQuarter: 1 | 2 | 3 | 4
  targetYear: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: RoadmapGoalStatus
  research_questions: string[]
  guidance_needed: string[]
  notes: string
  sub_goals: RoadmapSubGoal[]
  tags: string[]
  topicReports: TopicReport[]
  personalContext?: string
  contextFiles?: string[]  // array of filenames, e.g. ["learnings.md", "projects.md"]
  createdAt: string
  updatedAt: string
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

  // Research
  researchRoadmapGoal: (goalId: string) => Promise<{ report: string; filePath: string }>
  researchRoadmapTopic: (goalId: string, topicIndex: number, topicType: 'question' | 'guidance') => Promise<{ report: string; generatedAt: string }>
  generateActionPlan: (goalId: string) => Promise<{ report: string; generatedAt: string }>
  generateTopics: (goalId: string) => Promise<{ added: { questions: number; guidance: number }; total: { questions: number; guidance: number } }>

  // Tweet posting
  postTweet: (text: string, replyToTweetId?: string) => Promise<{ success: boolean; tweetId?: string; error?: string }>
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
  onTasksUpdated: (callback: () => void) => () => void

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

  // LLM Settings
  getLLMSettings: () => Promise<LLMSettings>
  saveLLMSettings: (settings: Partial<LLMSettings>) => Promise<LLMSettings>
  verifyLLMKey: (provider: string, key: string) => Promise<{ valid: boolean; error?: string }>
  getProviderModels: () => Promise<Record<string, { primary: { id: string; name: string }[]; fast: { id: string; name: string }[] }>>
  getProviderChatModels: () => Promise<Record<string, { id: string; name: string }[]>>

  // Chat streaming
  chatSendMessage: (conversationId: string, messages: { role: string; content: string }[], systemPrompt?: string) => Promise<void>
  chatAbort: () => Promise<void>
  getMemoryCountForChat: (messages: { role: string; content: string }[]) => Promise<number>
  onChatStreamChunk: (callback: (data: { conversationId: string; text: string }) => void) => () => void
  onChatStreamEnd: (callback: (data: { conversationId: string; model: string; usage: { input: number; output: number } }) => void) => () => void
  onChatStreamError: (callback: (data: { conversationId: string; error: string }) => void) => () => void

  // CLI logs
  getCliSessions: () => Promise<CLISession[]>
  getCliSessionMessages: (sessionId: string, offset?: number, limit?: number) => Promise<{ messages: CLISessionMessage[]; hasMore: boolean }>
  searchCliSessions: (query: string) => Promise<{ sessionId: string; firstPrompt: string; matches: string[]; project: string }[]>
  searchGitHubRepos: (query: string) => Promise<GitHubRepoResult[]>

  // Tweet drafts
  getTweetDrafts: () => Promise<TweetDraft[]>
  getTweetDraft: (id: string) => Promise<TweetDraft | null>
  createTweetDraft: (topic?: string) => Promise<TweetDraft>
  updateTweetDraft: (id: string, updates: Partial<TweetDraft>) => Promise<TweetDraft | null>
  addTweetAIMessage: (draftId: string, msg: TweetAIMessage) => Promise<TweetDraft | null>
  deleteTweetDraft: (id: string) => Promise<void>

  // Tweet AI
  tweetBrainstorm: (topic: string, history: { role: string; content: string }[], persona?: TweetPersona) => Promise<string>
  tweetBrainstormThread: (topic: string, history: { role: string; content: string }[], persona?: TweetPersona) => Promise<string>
  tweetRefine: (text: string, instruction: string, history: { role: string; content: string }[], persona?: TweetPersona) => Promise<string>
  tweetAnalyze: (text: string) => Promise<string>

  // Tweet Personas
  getTweetPersonas: () => Promise<TweetPersona[]>
  createTweetPersona: (persona: Omit<TweetPersona, 'id' | 'isBuiltIn' | 'createdAt'>) => Promise<TweetPersona>
  deleteTweetPersona: (id: string) => Promise<void>

  // Launch external terminal
  launchExternalTerminal: (prompt: string, cwd?: string) => Promise<void>

  // AI Tasks
  getAITasks: () => Promise<AITask[]>
  createAITask: (task: { title: string; description: string; priority: 'low' | 'medium' | 'high'; tags: string[] }) => Promise<AITask>
  updateAITask: (id: string, updates: Partial<AITask>) => Promise<AITask | null>
  deleteAITask: (id: string) => Promise<void>
  moveAITask: (id: string, column: AITask['column']) => Promise<AITask | null>

  // Roadmap
  getRoadmapGoals: () => Promise<RoadmapGoal[]>
  createRoadmapGoal: (goal: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<RoadmapGoal>
  updateRoadmapGoal: (id: string, updates: Partial<RoadmapGoal>) => Promise<RoadmapGoal | null>
  deleteRoadmapGoal: (id: string) => Promise<void>

  // Master Plan
  getMasterPlan: () => Promise<MasterPlan | null>
  generateMasterPlan: () => Promise<MasterPlan>
  clearMasterPlan: () => Promise<void>

  // Master Plan Execution
  generateContextQuestions: () => Promise<{ goalId: string; questions: string[] }[]>
  getMasterPlanTasks: (planDate?: string) => Promise<MasterPlanTask[]>
  updateMasterPlanTask: (id: string, updates: Partial<MasterPlanTask>) => Promise<MasterPlanTask | null>
  launchDailyPlan: (taskIds?: string[]) => Promise<{ launched: number; taskIds: string[] }>
  pollTaskSessions: () => Promise<MasterPlanTask[]>

  // Goal Action Plan Execution
  extractGoalActionTasks: (goalId: string) => Promise<MasterPlanTask[]>
  launchGoalTasks: (goalId: string, taskIds?: string[]) => Promise<{ launched: number; taskIds: string[] }>
  pollGoalTaskSessions: (goalId: string) => Promise<MasterPlanTask[]>
  getGoalWorkspace: (goalId: string) => Promise<string | null>
  getGoalDeliverables: (goalId: string) => Promise<{ name: string; size: number; modifiedAt: string }[]>
  getGoalGitLog: (goalId: string) => Promise<GitLogEntry[]>
  getGoalRepoInfo: (goalId: string) => Promise<{ path: string; commitCount: number; fileCount: number; sizeBytes: number } | null>
  extractGoalLearnings: (goalId: string) => Promise<{ memoriesCreated: number; memories: Memory[] }>

  // Smart Query
  smartQuery: (query: string) => Promise<{ queryId: string }>
  onSmartQueryChunk: (callback: (data: { queryId: string; text: string }) => void) => () => void
  onSmartQueryEnd: (callback: (data: { queryId: string }) => void) => () => void
  onSmartQueryError: (callback: (data: { queryId: string; error: string }) => void) => () => void

  // Welcome modal
  isWelcomeDismissed: () => Promise<boolean>
  dismissWelcome: () => Promise<void>

  // Context Files
  getContextFiles: () => Promise<ContextFile[]>
  saveContextFile: (name: string, content: string, folder?: string) => Promise<ContextFile>
  deleteContextFile: (name: string) => Promise<boolean>
  createContextFolder: (relativePath: string) => Promise<boolean>
  deleteContextFolder: (relativePath: string) => Promise<boolean>
  uploadContextFiles: (targetFolder: string) => Promise<ContextFile[]>
  scaffoldDomainFolders: () => Promise<boolean>

  // Whisper (local voice transcription)
  transcribeAudio: (audioData: number[]) => Promise<string>
  getWhisperStatus: () => Promise<WhisperStatus>

  // RAG / Embeddings
  getEmbeddingStatus: () => Promise<EmbeddingStatus>
  rebuildVectorIndex: () => Promise<{ added: number; removed: number; total: number }>
  generateReorgPlan: () => Promise<ReorgPlan>
  executeReorgPlan: (plan: ReorgPlan) => Promise<{ success: boolean; backupPath: string }>
  onEmbeddingProgress: (callback: (progress: number) => void) => () => void
  onIndexProgress: (callback: (info: { phase: string; current: number; total: number }) => void) => () => void

  // Memory
  getMemories: () => Promise<Memory[]>
  createMemory: (memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Memory>
  updateMemory: (id: string, updates: Partial<Memory>) => Promise<Memory | null>
  deleteMemory: (id: string) => Promise<void>
  archiveMemory: (id: string) => Promise<Memory | null>
  pinMemory: (id: string) => Promise<Memory | null>
  getMemoryTopics: () => Promise<MemoryTopic[]>
  updateMemoryTopics: (topics: MemoryTopic[]) => Promise<MemoryTopic[]>
  getMemorySettings: () => Promise<MemorySettings>
  saveMemorySettings: (settings: Partial<MemorySettings>) => Promise<MemorySettings>
  extractMemoriesFromChat: (conversationId: string) => Promise<Memory[]>
  extractMemoriesFromCli: (sessionId: string) => Promise<Memory[]>
  extractMemoriesFromJournal: (date: string) => Promise<Memory[]>
  batchExtractMemories: () => Promise<Memory[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
