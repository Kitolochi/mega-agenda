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

export interface PomodoroHistoryRecord {
  id: string
  taskId: number | null
  taskTitle: string
  startedAt: string
  completedAt: string
  durationMinutes: number
  type: 'work' | 'break'
}

export interface PomodoroStats {
  todaySessions: number
  todayMinutes: number
  weekSessions: number
  weekMinutes: number
  streak: number
  mostFocusedTask: string | null
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

export type VoiceChatState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error'

export interface VoiceChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
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

export interface CompressionStats {
  inputTokens: number
  outputTokens: number
  ratio: number
  chunksProcessed: number
  duplicatesRemoved: number
  clustersFound: number
}

export interface DomainSummary {
  domain: string
  label: string
  summary: string
  facts: string[]
  embedding?: number[]  // cached centroid embedding for fast similarity lookup
}

export interface CompressedKnowledge {
  overview: string
  domains: DomainSummary[]
  lastCompressed: string
  fileHashSnapshot: Record<string, string>
  stats: CompressionStats
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

export interface GoalActivityEntry {
  id: string
  type: 'topics_found' | 'topic_researched' | 'action_plan_generated' | 'tasks_extracted' | 'tasks_launched' | 'task_completed'
  description: string
  timestamp: string
}

export interface ResearchQueueProgress {
  goalId: string
  currentTopic: string
  currentTopicType: 'question' | 'guidance'
  completedCount: number
  totalCount: number
  status: 'researching' | 'completed' | 'failed' | 'cancelled'
  error?: string
}

export interface TopicReport {
  topic: string
  type: 'question' | 'guidance'
  report: string
  generatedAt: string
  model?: string
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
  topicGroups?: TopicGroup[]
  activityLog?: GoalActivityEntry[]
  createdAt: string
  updatedAt: string
}

export interface TopicGroup {
  label: string
  topics: { text: string; type: 'question' | 'guidance' }[]
}

export interface KnowledgeCluster {
  label: string
  summary: string
  facts: string[]
  memoryCount: number
}

export interface KnowledgePack {
  id: string
  createdAt: string
  overview: string
  clusters: KnowledgeCluster[]
  stats: {
    totalMemories: number
    totalContextFiles: number
    totalChunks: number
    totalFacts: number
    compressionRatio: number
    durationMs: number
  }
}

export interface CompressionProgress {
  phase: 'embedding' | 'dedup' | 'clustering' | 'summarizing' | 'extracting' | 'overview' | 'done'
  percent: number
  detail: string
}

export interface CompressionAudit {
  coverageScore: number
  totalOriginalItems: number
  coveredItems: number
  uncoveredItems: { text: string; source: string; bestMatchScore: number }[]
  clusterCoverage: { label: string; itemCount: number; factCount: number; avgCoverage: number }[]
  duplicatesRemoved: number
}

export interface MemoryHealth {
  totalMemories: number
  totalTokens: number
  tokenBudget: number
  budgetUsagePercent: number
  status: 'healthy' | 'warning' | 'critical'
  staleMemoryCount: number
  recommendation: string
}

export interface SingleFileTestResult {
  fileName: string
  originalSize: number
  originalText: string
  chunks: number
  clusters: KnowledgeCluster[]
  totalFacts: number
  overview: string
  durationMs: number
}

export interface ContextFileInfo {
  name: string
  size: number
  isStub: boolean
  authority: number
}

export interface FolderCompressionResult {
  folder: string
  fileCount: number
  filesUsed: { name: string; authority: number; chunksContributed: number }[]
  clusters: KnowledgeCluster[]
  overview: string
  totalFacts: number
  dedupRemoved: number
  conflictsResolved: boolean
  durationMs: number
}

// Network CRM Types
export type InteractionType = 'call' | 'email' | 'meeting' | 'message' | 'note'

export interface NetworkContact {
  id: string
  name: string
  company: string
  role: string
  email: string
  phone: string
  socialLinks: { twitter?: string; linkedin?: string; github?: string }
  notes: string
  tags: string[]
  avatarColor: string
  createdAt: string
  updatedAt: string
}

export interface ContactInteraction {
  id: string
  contactIds: string[]
  type: InteractionType
  subject: string
  notes: string
  date: string
  createdAt: string
}

export interface Pipeline {
  id: string
  name: string
  stages: string[]
  createdAt: string
  updatedAt: string
}

export interface PipelineCard {
  id: string
  contactId: string
  pipelineId: string
  stage: string
  title: string
  description: string
  value: string
  createdAt: string
  updatedAt: string
}

// Social Connector Types
export type SocialProvider = 'telegram' | 'discord' | 'twitter' | 'sms'
export type SocialConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'error'

export interface SocialConnection {
  id: string
  provider: SocialProvider
  accountId: string
  accountName: string
  status: SocialConnectionStatus
  lastSyncAt: string | null
  credentials: string
  createdAt: string
  updatedAt: string
}

export interface ContactMapping {
  id: string
  contactId: string
  provider: SocialProvider
  externalId: string
  externalName: string
  createdAt: string
}

// Bank Sync Types
export type BankProvider = 'simplefin' | 'teller'
export type BankConnectionStatus = 'active' | 'error' | 'disconnected'

export interface BankConnection {
  id: string
  provider: BankProvider
  accessToken: string  // SimpleFIN access URL or Teller access token
  status: BankConnectionStatus
  errorMessage?: string
  lastSynced?: string  // ISO 8601
  createdAt: string
  updatedAt: string
}

export type BankAccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment' | 'other'

export interface BankAccount {
  id: string
  connectionId: string
  externalId: string  // Provider's account ID
  name: string
  institution: string
  accountType: BankAccountType
  balance: number      // Current balance in cents (negative = debt)
  availableBalance?: number  // Available balance in cents
  currency: string
  lastSynced?: string
}

export interface BankTransaction {
  id: string
  accountId: string
  externalId: string   // Provider's transaction ID
  dedupHash: string    // For deduplication
  amount: number       // In cents (negative = debit)
  date: string         // YYYY-MM-DD
  description: string
  category?: string
  merchant?: string
  pending: boolean
  importedAt: string
}

// Outreach Types
export type OutreachBusinessStatus = 'New' | 'Contacted' | 'Responded' | 'Not Interested' | 'Meeting Scheduled'
export type OutreachChannel = 'email' | 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'website'

export interface OutreachBusiness {
  id: string
  name: string
  address: string
  phone: string
  website: string
  category: string
  source: string
  lat: number | null
  lng: number | null
  rating: number | null
  reviewCount: number | null
  socialLinks: Record<string, string>
  status: OutreachBusinessStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface OutreachContact {
  id: string
  businessId: string
  name: string
  title: string
  email: string
  linkedinUrl: string
  source: string
  createdAt: string
}

export interface OutreachMessage {
  id: string
  businessId: string
  contactId: string | null
  channel: OutreachChannel
  messageText: string
  status: string
  sentAt: string | null
  respondedAt: string | null
  createdAt: string
}

export interface OutreachTemplate {
  id: string
  name: string
  channel: OutreachChannel
  subject: string
  body: string
  variables: string[]
  createdAt: string
}

export interface OutreachPipelineStats {
  status: OutreachBusinessStatus
  count: number
}

// Content Writer Types
export type ContentType = 'tweet' | 'thread' | 'blog_post' | 'article' | 'discord_post' | 'newsletter'

export interface TweetScore {
  index: number
  hook: number
  clarity: number
  viral: number
  feedback?: string
  strengths?: string[]
  weaknesses?: string[]
}

export interface TweetPattern {
  id: string
  type: 'positive' | 'negative'
  pattern: string
  avgScore: number
  occurrences: number
  exampleTweet: string
  extractedAt: string
}

export interface ScoreSnapshot {
  date: string
  draftsScored: number
  tweetsScored: number
  avgHook: number
  avgClarity: number
  avgViral: number
  avgOverall: number
  above8Count: number
  below5Count: number
}

export interface ContentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ContentDraft {
  id: string
  contentType: ContentType
  topic: string
  research: string
  outline: string
  content: string
  messages: ContentMessage[]
  status: 'researching' | 'outlined' | 'drafting' | 'refining' | 'ready'
  scores?: TweetScore[]
  createdAt: string
  updatedAt: string
}

export interface SessionInsight {
  id: number
  date_from: string
  date_to: string
  project: string | null
  tweets: { text: string; theme: string; format?: string; source_project?: string }[]
  created_at: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  color: string
  source: 'manual' | 'gcal'
  gcalEventId?: string
  recurrence?: 'weekly'
  createdAt: string
}

export interface Routine {
  id: string
  name: string
  type: 'morning-briefing' | 'pr-monitor' | 'email-digest' | 'weekly-review' | 'custom'
  schedule: {
    trigger: 'app-launch' | 'interval' | 'daily' | 'weekly'
    time?: string
    intervalMinutes?: number
    dayOfWeek?: number
  }
  config: Record<string, any>
  enabled: boolean
  lastRun?: string
  createdAt: string
}

export interface RoutineResult {
  id: string
  routineId: string
  timestamp: string
  summary: string
  detail: string
  status: 'success' | 'error'
  date: string
}

// Agent Orchestration Types
export interface Agent {
  id: string
  name: string
  role: 'engineer' | 'researcher' | 'writer' | 'planner' | 'designer' | 'custom'
  description: string
  adapter: 'claude_local'
  adapterConfig: {
    taskType?: 'research' | 'code' | 'writing' | 'planning' | 'communication'
    allowedTools?: string
    preamble?: string
    cwd?: string
  }
  reportsTo?: string
  budgetMonthlyCents: number
  spentMonthlyCents: number
  budgetResetDate: string
  status: 'active' | 'paused' | 'idle' | 'running' | 'error'
  lastError?: string
  heartbeat?: {
    enabled: boolean
    schedule: { trigger: 'interval' | 'daily' | 'weekly'; time?: string; intervalMinutes?: number; dayOfWeek?: number }
    lastRun?: string
  }
  sessionState?: {
    sessionId?: string
    cumulativeInputTokens: number
    cumulativeOutputTokens: number
    cumulativeCostCents: number
  }
  createdAt: string
  updatedAt: string
}

export interface AgentIssue {
  id: string
  title: string
  description: string
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignedAgentId?: string
  goalId?: string
  tags: string[]
  checkedOutAt?: string
  checkedOutRunId?: string
  result?: string
  deliverables?: string[]
  createdAt: string
  updatedAt: string
}

export interface HeartbeatRun {
  id: string
  agentId: string
  issueId?: string
  source: 'timer' | 'manual' | 'assignment'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out'
  prompt: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  sessionId?: string
  inputTokens?: number
  outputTokens?: number
  costCents?: number
  summary?: string
  error?: string
  tags?: string[]
  createdAt: string
}

export interface CostEvent {
  id: string
  agentId: string
  issueId?: string
  heartbeatRunId?: string
  source: 'heartbeat' | 'chat' | 'research' | 'manual'
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costCents: number
  timestamp: string
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
  researchRoadmapGoal: (goalId: string) => Promise<{ researched: number; total: number }>
  onResearchProgress: (callback: (data: ResearchQueueProgress) => void) => () => void
  cancelResearch: () => Promise<void>
  researchRoadmapTopic: (goalId: string, topicIndex: number, topicType: 'question' | 'guidance') => Promise<{ report: string; generatedAt: string }>
  generateActionPlan: (goalId: string) => Promise<{ report: string; generatedAt: string }>
  generateTopics: (goalId: string, direction?: string) => Promise<{ added: { questions: number; guidance: number }; total: { questions: number; guidance: number } }>
  removeTopicReport: (goalId: string, topic: string, topicType: string) => Promise<{ removed: number; remaining: number }>
  purgeStubReports: (goalId: string) => Promise<{ removed: number; remaining: number }>
  categorizeGoalTopics: (goalId: string) => Promise<TopicGroup[]>

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
  savePomodoroSession: (record: Omit<PomodoroHistoryRecord, 'id'>) => Promise<PomodoroHistoryRecord>
  getPomodoroStats: () => Promise<PomodoroStats>

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

  // CLI Mode
  getUseCliMode: () => Promise<boolean>
  setUseCliMode: (enabled: boolean) => Promise<boolean>
  checkCliAvailable: () => Promise<{ available: boolean; path: string | null }>

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
  transcribeAudioBlob: (webmData: number[]) => Promise<string>
  getWhisperStatus: () => Promise<WhisperStatus>

  // RAG / Embeddings
  getEmbeddingStatus: () => Promise<EmbeddingStatus>
  rebuildVectorIndex: () => Promise<{ added: number; removed: number; total: number }>
  generateReorgPlan: () => Promise<ReorgPlan>
  executeReorgPlan: (plan: ReorgPlan) => Promise<{ success: boolean; backupPath: string }>
  onEmbeddingProgress: (callback: (progress: number) => void) => () => void
  onIndexProgress: (callback: (info: { phase: string; current: number; total: number }) => void) => () => void

  // Knowledge Pack
  getKnowledgePacks: () => Promise<KnowledgePack[]>
  compressKnowledge: () => Promise<KnowledgePack>
  auditCompression: () => Promise<CompressionAudit>
  getMemoryHealth: () => Promise<MemoryHealth>
  autoPruneMemories: () => Promise<number>
  startHealthMonitor: (intervalMs: number) => Promise<void>
  stopHealthMonitor: () => Promise<void>
  onCompressionProgress: (callback: (progress: CompressionProgress) => void) => () => void
  onMemoryHealthUpdate: (callback: (health: MemoryHealth) => void) => () => void

  // Lab tools
  compressSingleFile: (relativePath: string) => Promise<SingleFileTestResult>
  compressFolder: (folder: string) => Promise<FolderCompressionResult>
  testEmbeddingSimilarity: (textA: string, textB: string) => Promise<{ similarity: number; embeddingDim: number }>
  listContextFiles: () => Promise<ContextFileInfo[]>

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

  // Network CRM
  getNetworkContacts: () => Promise<NetworkContact[]>
  getNetworkContact: (id: string) => Promise<NetworkContact | null>
  createNetworkContact: (contact: Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<NetworkContact>
  updateNetworkContact: (id: string, updates: Partial<NetworkContact>) => Promise<NetworkContact | null>
  deleteNetworkContact: (id: string) => Promise<void>
  getContactInteractions: (contactId?: string) => Promise<ContactInteraction[]>
  createContactInteraction: (interaction: Omit<ContactInteraction, 'id' | 'createdAt'>) => Promise<ContactInteraction>
  deleteContactInteraction: (id: string) => Promise<void>
  getPipelines: () => Promise<Pipeline[]>
  createPipeline: (pipeline: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Pipeline>
  updatePipeline: (id: string, updates: Partial<Pipeline>) => Promise<Pipeline | null>
  deletePipeline: (id: string) => Promise<void>
  getPipelineCards: (pipelineId?: string) => Promise<PipelineCard[]>
  createPipelineCard: (card: Omit<PipelineCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PipelineCard>
  updatePipelineCard: (id: string, updates: Partial<PipelineCard>) => Promise<PipelineCard | null>
  movePipelineCard: (id: string, stage: string) => Promise<PipelineCard | null>
  deletePipelineCard: (id: string) => Promise<void>

  // Social Connectors
  getSocialConnections: () => Promise<SocialConnection[]>
  connectSocialProvider: (provider: SocialProvider, credentials: any) => Promise<SocialConnection>
  disconnectSocialProvider: (connectionId: string) => Promise<void>
  deleteSocialConnection: (connectionId: string) => Promise<void>
  syncSocialProvider: (connectionId: string) => Promise<{ newContacts: number; newInteractions: number }>
  getContactMappings: (contactId?: string) => Promise<ContactMapping[]>
  deleteContactMapping: (id: string) => Promise<void>
  telegramSendCode: (phone: string, apiId: number, apiHash: string) => Promise<{ phoneCodeHash: string }>
  telegramVerifyCode: (phone: string, code: string, phoneCodeHash: string, apiId: number, apiHash: string) => Promise<{ session: string; accountId: string; accountName: string }>
  smsDetectDb: () => Promise<{ found: boolean; path: string | null }>
  getSocialSyncStatus: (connectionId: string) => Promise<{ status: SocialConnectionStatus; lastSyncAt: string | null }>
  twitterSyncContacts: () => Promise<{ newContacts: number; newInteractions: number }>

  // Content Writer
  getContentDrafts: () => Promise<ContentDraft[]>
  getContentDraft: (id: string) => Promise<ContentDraft | null>
  createContentDraft: (topic?: string) => Promise<ContentDraft>
  updateContentDraft: (id: string, updates: Partial<ContentDraft>) => Promise<ContentDraft | null>
  deleteContentDraft: (id: string) => Promise<void>
  contentResearch: (draftId: string, topic: string) => Promise<void>
  contentResearchAbort: () => Promise<void>
  contentGenerate: (draftId: string, messages: { role: string; content: string }[], contentType: ContentType) => Promise<void>
  contentAbort: () => Promise<void>
  onContentResearchChunk: (callback: (data: { draftId: string; text: string }) => void) => () => void
  onContentResearchEnd: (callback: (data: { draftId: string }) => void) => () => void
  onContentResearchError: (callback: (data: { draftId: string; error: string }) => void) => () => void
  onContentStreamChunk: (callback: (data: { draftId: string; text: string }) => void) => () => void
  onContentStreamEnd: (callback: (data: { draftId: string }) => void) => () => void
  onContentStreamError: (callback: (data: { draftId: string; error: string }) => void) => () => void
  onContentScoresReady: (callback: (data: { draftId: string; scores: TweetScore[] }) => void) => () => void
  onContentScoresError: (callback: (data: { draftId: string; error: string }) => void) => () => void
  getScoreSnapshots: () => Promise<ScoreSnapshot[]>
  getTweetPatterns: () => Promise<TweetPattern[]>
  extractTweetPatterns: () => Promise<TweetPattern[]>
  getSessionInsights: () => Promise<SessionInsight[]>
  importSessionTweet: (text: string, topic: string) => Promise<ContentDraft>
  onContentAutoRefineStart: (callback: (data: { draftId: string; weakCount: number; avgScore: number }) => void) => () => void

  // Bank Sync
  getBankConnections: () => Promise<BankConnection[]>
  connectBank: (provider: BankProvider, token: string) => Promise<BankConnection>
  deleteBankConnection: (id: string) => Promise<void>
  syncBankConnection: (id: string) => Promise<{ accounts: BankAccount[]; newTransactions: number }>
  syncAllBankConnections: () => Promise<void>
  getBankAccounts: () => Promise<BankAccount[]>
  getBankTransactions: (accountId?: string, limit?: number) => Promise<BankTransaction[]>
  getCategoryOverrides: () => Promise<Record<string, string>>
  setCategoryOverride: (transactionId: string, categoryKey: string) => Promise<Record<string, string>>
  removeCategoryOverride: (transactionId: string) => Promise<Record<string, string>>

  // Outreach Settings
  getOutreachSettings: () => Promise<{
    google_places_api_key: string
    apollo_api_key: string
    default_lat: string
    default_lng: string
    default_radius: string
    resume_link: string
    onboarding_completed: string
    gws_installed: string
    gws_authenticated: string
    gws_user_email: string
  }>
  setOutreachSetting: (key: string, value: string) => Promise<any>
  validateApiKey: (keyType: 'google_places' | 'apollo', apiKey: string) => Promise<{ valid: boolean; message: string }>
  runSeedDiscovery: () => Promise<{ totalImported: number; categories: number }>
  getOutreachBusinessCount: () => Promise<number>
  onSeedProgress: (callback: (data: { category: string; categoryIndex: number; totalCategories: number; imported: number; totalImported: number }) => void) => () => void

  // Auto-Research
  runAutoResearch: () => Promise<{ discovered: number; enriched: number; contactsFound: number; socialLinksFound: number; error?: string }>
  onAutoResearchProgress: (callback: (data: { phase: string; status: string; message: string; [key: string]: any }) => void) => () => void

  // Outreach
  searchBusinesses: (query: string, location?: string) => Promise<OutreachBusiness[]>
  scrapeBusinesses: (urls: string[]) => Promise<OutreachBusiness[]>
  getBusinesses: (filters?: any) => Promise<OutreachBusiness[]>
  getBusiness: (id: string) => Promise<OutreachBusiness | null>
  importBusinesses: (businesses: any[]) => Promise<OutreachBusiness[]>
  updateBusiness: (id: string, updates: Partial<OutreachBusiness>) => Promise<OutreachBusiness | null>
  deleteBusiness: (id: string) => Promise<void>
  enrichBusiness: (id: string) => Promise<OutreachBusiness | null>
  getBusinessContacts: (businessId: string) => Promise<OutreachContact[]>
  createContact: (data: Omit<OutreachContact, 'id' | 'createdAt'>) => Promise<OutreachContact>
  getOutreachHistory: (businessId: string) => Promise<OutreachMessage[]>
  createOutreach: (data: Omit<OutreachMessage, 'id' | 'createdAt'>) => Promise<OutreachMessage>
  getTemplates: () => Promise<OutreachTemplate[]>
  createTemplate: (data: Omit<OutreachTemplate, 'id' | 'createdAt'>) => Promise<OutreachTemplate>
  updateTemplate: (id: string, updates: Partial<OutreachTemplate>) => Promise<OutreachTemplate | null>
  deleteTemplate: (id: string) => Promise<void>
  generateMessage: (templateId: string, businessId: string, options?: any) => Promise<string>
  getOutreachPipelineStats: () => Promise<OutreachPipelineStats[]>
  updateOutreach: (id: string, updates: Partial<OutreachMessage>) => Promise<OutreachMessage | null>

  // Calendar
  getCalendarEvents: (startDate: string, endDate: string) => Promise<CalendarEvent[]>
  getDailyAgenda: (date: string) => Promise<{ tasks: Task[]; events: CalendarEvent[] }>
  createCalendarEvent: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => Promise<CalendarEvent>
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<CalendarEvent | null>
  deleteCalendarEvent: (id: string) => Promise<void>
  getCalendarHistory: (query?: string, limit?: number) => Promise<{ tasks: Task[]; events: CalendarEvent[] }>
  syncGcalEvents: () => Promise<{ success: boolean; synced?: number; error?: string }>
  fireDailyNotification: () => Promise<string | null>

  // Routines
  getRoutines: () => Promise<Routine[]>
  getRoutine: (id: string) => Promise<Routine | null>
  createRoutine: (data: Omit<Routine, 'id' | 'createdAt'>) => Promise<Routine>
  updateRoutine: (id: string, updates: Partial<Routine>) => Promise<Routine | null>
  deleteRoutine: (id: string) => Promise<void>
  runRoutine: (id: string) => Promise<RoutineResult | null>
  getRoutineResults: (routineId?: string, date?: string, limit?: number) => Promise<RoutineResult[]>
  getRoutineResultsForDate: (date: string) => Promise<RoutineResult[]>
  deleteRoutineResult: (id: string) => Promise<void>
  onRoutinesUpdated: (callback: () => void) => () => void

  // Agent Orchestration
  getAgents: () => Promise<Agent[]>
  getAgent: (id: string) => Promise<Agent | null>
  createAgent: (data: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'spentMonthlyCents' | 'budgetResetDate' | 'status'>) => Promise<Agent>
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<Agent | null>
  deleteAgent: (id: string) => Promise<void>
  setAgentStatus: (id: string, status: Agent['status'], lastError?: string) => Promise<Agent | null>
  getAgentIssues: (filters?: { agentId?: string; status?: AgentIssue['status'] }) => Promise<AgentIssue[]>
  getAgentIssue: (id: string) => Promise<AgentIssue | null>
  createAgentIssue: (data: Omit<AgentIssue, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AgentIssue>
  updateAgentIssue: (id: string, updates: Partial<AgentIssue>) => Promise<AgentIssue | null>
  deleteAgentIssue: (id: string) => Promise<void>
  getHeartbeatRuns: (filters?: { agentId?: string; issueId?: string; limit?: number }) => Promise<HeartbeatRun[]>
  runAgentHeartbeat: (agentId: string, issueId?: string) => Promise<HeartbeatRun | null>
  completeHeartbeatRun: (runId: string, updates: Partial<HeartbeatRun>) => Promise<HeartbeatRun | null>
  getCostEvents: (filters?: { agentId?: string; limit?: number }) => Promise<CostEvent[]>
  getAgentCostSummary: (agentId: string) => Promise<{ totalCents: number; monthCents: number; eventCount: number }>
  pollAgentSessions: () => Promise<HeartbeatRun[]>
  onAgentsUpdated: (callback: () => void) => () => void

  // Guide Chat
  guideChatSend: (messages: { role: string; content: string }[]) => Promise<void>
  guideChatAbort: () => Promise<void>
  onGuideChatChunk: (callback: (data: { text: string }) => void) => () => void
  onGuideChatEnd: (callback: (data: { model: string }) => void) => () => void
  onGuideChatError: (callback: (data: { error: string }) => void) => () => void

  // Google Workspace CLI
  gwsCheckAuth: () => Promise<{ installed: boolean; authenticated: boolean; error?: string }>
  gwsSendEmail: (params: { outreachId?: string; businessId: string; to: string; subject: string; body: string }) =>
    Promise<{ success: boolean; messageId?: string; error?: string }>
  gwsCreateEvent: (params: { businessId: string; summary: string; startDateTime: string; endDateTime: string; attendeeEmail?: string; description?: string }) =>
    Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }>
  gwsExportSheets: () => Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }>
  gwsUploadDrive: (params: { format: 'csv' | 'json' }) =>
    Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
