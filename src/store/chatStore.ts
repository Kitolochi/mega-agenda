import { create } from 'zustand'
import { ChatConversation, ChatMessage, ChatSettings } from '../types'
import { generateId } from '../utils/formatting'

interface ChatState {
  // Conversation state
  conversations: ChatConversation[]
  activeConvId: string | null
  input: string
  streaming: boolean
  streamText: string
  showSidebar: boolean

  // Settings
  settings: ChatSettings | null
  showSettings: boolean
  chatModels: { id: string; name: string }[]

  // Rename state
  renameId: string | null
  renameValue: string

  // Memory
  memoryCount: number
  extractingMemories: boolean
  extractedCount: number | null

  // Smart query
  smartQueryText: string
  smartQueryId: string | null
  smartQueryStreaming: boolean

  // Computed
  getActiveConv: () => ChatConversation | null

  // Actions
  setConversations: (convs: ChatConversation[]) => void
  setActiveConvId: (id: string | null) => void
  setInput: (input: string) => void
  setStreaming: (streaming: boolean) => void
  setStreamText: (text: string) => void
  setShowSidebar: (show: boolean) => void
  setSettings: (settings: ChatSettings | null) => void
  setShowSettings: (show: boolean) => void
  setChatModels: (models: { id: string; name: string }[]) => void
  setRenameId: (id: string | null) => void
  setRenameValue: (value: string) => void
  setMemoryCount: (count: number) => void
  setExtractingMemories: (extracting: boolean) => void
  setExtractedCount: (count: number | null) => void
  setSmartQueryText: (text: string) => void
  setSmartQueryId: (id: string | null) => void
  setSmartQueryStreaming: (streaming: boolean) => void

  // Complex actions
  loadConversations: () => Promise<void>
  loadSettings: () => Promise<void>
  handleNewConversation: () => Promise<void>
  handleDeleteConversation: (id: string) => Promise<void>
  handleRename: (id: string) => Promise<void>
  handleSmartQuery: (query: string) => Promise<void>
  handleSend: (
    streamTextRef: React.MutableRefObject<string>,
    smartQueryTextRef: React.MutableRefObject<string>,
    inputRef: React.RefObject<HTMLTextAreaElement>
  ) => Promise<void>
  handleAbort: (streamTextRef: React.MutableRefObject<string>) => Promise<void>
  handleSaveSettings: (updates: Partial<ChatSettings>) => Promise<void>
  handleExtractMemories: () => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Conversation state
  conversations: [],
  activeConvId: null,
  input: '',
  streaming: false,
  streamText: '',
  showSidebar: false,

  // Settings
  settings: null,
  showSettings: false,
  chatModels: [],

  // Rename state
  renameId: null,
  renameValue: '',

  // Memory
  memoryCount: 0,
  extractingMemories: false,
  extractedCount: null,

  // Smart query
  smartQueryText: '',
  smartQueryId: null,
  smartQueryStreaming: false,

  // Computed
  getActiveConv: () => {
    const { conversations, activeConvId } = get()
    return conversations.find(c => c.id === activeConvId) || null
  },

  // Simple setters
  setConversations: (convs) => set({ conversations: convs }),
  setActiveConvId: (id) => set({ activeConvId: id }),
  setInput: (input) => set({ input }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamText: (text) => set({ streamText: text }),
  setShowSidebar: (show) => set({ showSidebar: show }),
  setSettings: (settings) => set({ settings }),
  setShowSettings: (show) => set({ showSettings: show }),
  setChatModels: (models) => set({ chatModels: models }),
  setRenameId: (id) => set({ renameId: id }),
  setRenameValue: (value) => set({ renameValue: value }),
  setMemoryCount: (count) => set({ memoryCount: count }),
  setExtractingMemories: (extracting) => set({ extractingMemories: extracting }),
  setExtractedCount: (count) => set({ extractedCount: count }),
  setSmartQueryText: (text) => set({ smartQueryText: text }),
  setSmartQueryId: (id) => set({ smartQueryId: id }),
  setSmartQueryStreaming: (streaming) => set({ smartQueryStreaming: streaming }),

  // Complex actions
  loadConversations: async () => {
    const convs = await window.electronAPI.getChatConversations()
    set({ conversations: convs })
  },

  loadSettings: async () => {
    const [s, llm, allModels] = await Promise.all([
      window.electronAPI.getChatSettings(),
      window.electronAPI.getLLMSettings(),
      window.electronAPI.getProviderChatModels(),
    ])
    const models = allModels[llm.provider] || []
    set({ settings: s, chatModels: models })
  },

  handleNewConversation: async () => {
    const conv = await window.electronAPI.createChatConversation('New chat')
    await get().loadConversations()
    set({ activeConvId: conv.id, showSidebar: false })
  },

  handleDeleteConversation: async (id) => {
    const { activeConvId } = get()
    await window.electronAPI.deleteChatConversation(id)
    if (activeConvId === id) set({ activeConvId: null })
    await get().loadConversations()
  },

  handleRename: async (id) => {
    const { renameValue } = get()
    if (renameValue.trim()) {
      await window.electronAPI.renameChatConversation(id, renameValue.trim())
      await get().loadConversations()
    }
    set({ renameId: null })
  },

  handleSmartQuery: async (query) => {
    set({ smartQueryText: '', smartQueryStreaming: true })
    try {
      const { queryId } = await window.electronAPI.smartQuery(query)
      set({ smartQueryId: queryId })
    } catch (err: any) {
      set({ smartQueryStreaming: false, smartQueryText: 'Error: ' + (err.message || 'Failed to start query') })
    }
  },

  handleSend: async (streamTextRef, smartQueryTextRef, _inputRef) => {
    const { input, streaming, activeConvId: currentActiveConvId, settings } = get()
    if (!input.trim() || streaming) return

    // /ask shortcut for smart query
    if (input.trim().startsWith('/ask ')) {
      const query = input.trim().slice(5).trim()
      if (query) {
        set({ input: '' })
        smartQueryTextRef.current = ''
        get().handleSmartQuery(query)
      }
      return
    }

    let convId = currentActiveConvId
    if (!convId) {
      const conv = await window.electronAPI.createChatConversation(input.trim().slice(0, 50))
      convId = conv.id
      set({ activeConvId: conv.id })
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    await window.electronAPI.addChatMessage(convId, userMsg)
    await get().loadConversations()

    // Auto-title: if this is the first message, rename from "New chat"
    const conv = await window.electronAPI.getChatConversation(convId)
    if (conv && conv.messages.length === 1 && conv.title === 'New chat') {
      await window.electronAPI.renameChatConversation(convId, input.trim().slice(0, 50))
      await get().loadConversations()
    }

    const messages = (conv?.messages || []).map(m => ({ role: m.role, content: m.content }))

    // Get memory count for context indicator
    try {
      const count = await window.electronAPI.getMemoryCountForChat(messages)
      set({ memoryCount: count })
    } catch { /* ignore */ }

    set({ input: '', streaming: true, streamText: '' })
    streamTextRef.current = ''

    const systemPrompt = settings?.systemPromptMode === 'context' ? undefined :
                          settings?.systemPromptMode === 'custom' ? settings.customSystemPrompt : undefined

    await window.electronAPI.chatSendMessage(convId, messages, systemPrompt)
  },

  handleAbort: async (streamTextRef) => {
    const { activeConvId } = get()
    await window.electronAPI.chatAbort()
    // Save partial response if any
    if (streamTextRef.current && activeConvId) {
      const msg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: streamTextRef.current + '\n\n*[Response stopped]*',
        timestamp: new Date().toISOString()
      }
      await window.electronAPI.addChatMessage(activeConvId, msg)
      await get().loadConversations()
    }
    streamTextRef.current = ''
    set({ streamText: '', streaming: false })
  },

  handleSaveSettings: async (updates) => {
    const s = await window.electronAPI.saveChatSettings(updates)
    set({ settings: s })
  },

  handleExtractMemories: async () => {
    const { activeConvId, extractingMemories } = get()
    if (!activeConvId || extractingMemories) return
    set({ extractingMemories: true, extractedCount: null })
    try {
      const created = await window.electronAPI.extractMemoriesFromChat(activeConvId)
      set({ extractedCount: created.length })
      setTimeout(() => set({ extractedCount: null }), 3000)
    } catch { /* ignore */ }
    set({ extractingMemories: false })
  },
}))
