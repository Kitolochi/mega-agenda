import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatConversation, ChatMessage, ChatSettings } from '../types'

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-surface-3 rounded-lg p-2.5 my-1.5 overflow-x-auto text-[11px] font-mono text-white/80"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-3 px-1 py-0.5 rounded text-[11px] font-mono text-accent-blue">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white/90">$1</strong>')
    .replace(/^\- (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-muted shrink-0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="ml-1">$&</div>')
    .replace(/\n/g, '<br/>')
}

export default function ChatView() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const [settings, setSettings] = useState<ChatSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [memoryCount, setMemoryCount] = useState(0)
  const [extractingMemories, setExtractingMemories] = useState(false)
  const [extractedCount, setExtractedCount] = useState<number | null>(null)
  const [smartQueryText, setSmartQueryText] = useState('')
  const [smartQueryId, setSmartQueryId] = useState<string | null>(null)
  const [smartQueryStreaming, setSmartQueryStreaming] = useState(false)
  const smartQueryTextRef = useRef('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamTextRef = useRef('')

  const activeConv = conversations.find(c => c.id === activeConvId) || null

  const loadConversations = useCallback(async () => {
    const convs = await window.electronAPI.getChatConversations()
    setConversations(convs)
  }, [])

  const loadSettings = useCallback(async () => {
    const s = await window.electronAPI.getChatSettings()
    setSettings(s)
  }, [])

  useEffect(() => {
    loadConversations()
    loadSettings()
  }, [loadConversations, loadSettings])

  // Stream event listeners
  useEffect(() => {
    const cleanupChunk = window.electronAPI.onChatStreamChunk((data) => {
      if (data.conversationId === activeConvId) {
        streamTextRef.current += data.text
        setStreamText(streamTextRef.current)
      }
    })

    const cleanupEnd = window.electronAPI.onChatStreamEnd(async (data) => {
      if (data.conversationId === activeConvId) {
        const finalText = streamTextRef.current
        const msg: ChatMessage = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
          model: data.model,
          tokenUsage: { input: data.usage.input, output: data.usage.output }
        }
        await window.electronAPI.addChatMessage(data.conversationId, msg)
        streamTextRef.current = ''
        setStreamText('')
        setStreaming(false)
        await loadConversations()
      }
    })

    const cleanupError = window.electronAPI.onChatStreamError((data) => {
      if (data.conversationId === activeConvId) {
        streamTextRef.current = ''
        setStreamText('')
        setStreaming(false)
        alert('Chat error: ' + data.error)
      }
    })

    return () => { cleanupChunk(); cleanupEnd(); cleanupError() }
  }, [activeConvId, loadConversations])

  // Smart Query event listeners
  useEffect(() => {
    const cleanupChunk = window.electronAPI.onSmartQueryChunk((data) => {
      if (data.queryId === smartQueryId) {
        smartQueryTextRef.current += data.text
        setSmartQueryText(smartQueryTextRef.current)
      }
    })
    const cleanupEnd = window.electronAPI.onSmartQueryEnd((data) => {
      if (data.queryId === smartQueryId) {
        setSmartQueryStreaming(false)
      }
    })
    const cleanupError = window.electronAPI.onSmartQueryError((data) => {
      if (data.queryId === smartQueryId) {
        setSmartQueryStreaming(false)
        if (!smartQueryTextRef.current) {
          setSmartQueryText('Error: ' + data.error)
        }
      }
    })
    return () => { cleanupChunk(); cleanupEnd(); cleanupError() }
  }, [smartQueryId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages, streamText])

  const handleNewConversation = async () => {
    const conv = await window.electronAPI.createChatConversation('New chat')
    await loadConversations()
    setActiveConvId(conv.id)
    setShowSidebar(false)
    inputRef.current?.focus()
  }

  const handleDeleteConversation = async (id: string) => {
    await window.electronAPI.deleteChatConversation(id)
    if (activeConvId === id) setActiveConvId(null)
    await loadConversations()
  }

  const handleRename = async (id: string) => {
    if (renameValue.trim()) {
      await window.electronAPI.renameChatConversation(id, renameValue.trim())
      await loadConversations()
    }
    setRenameId(null)
  }

  const handleSmartQuery = async (query: string) => {
    smartQueryTextRef.current = ''
    setSmartQueryText('')
    setSmartQueryStreaming(true)
    try {
      const { queryId } = await window.electronAPI.smartQuery(query)
      setSmartQueryId(queryId)
    } catch (err: any) {
      setSmartQueryStreaming(false)
      setSmartQueryText('Error: ' + (err.message || 'Failed to start query'))
    }
  }

  const handleSend = async () => {
    if (!input.trim() || streaming) return

    // /ask shortcut for smart query
    if (input.trim().startsWith('/ask ')) {
      const query = input.trim().slice(5).trim()
      if (query) {
        setInput('')
        handleSmartQuery(query)
      }
      return
    }

    let convId = activeConvId
    if (!convId) {
      const conv = await window.electronAPI.createChatConversation(input.trim().slice(0, 50))
      convId = conv.id
      setActiveConvId(conv.id)
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    await window.electronAPI.addChatMessage(convId, userMsg)
    await loadConversations()

    // Auto-title: if this is the first message, rename from "New chat"
    const conv = await window.electronAPI.getChatConversation(convId)
    if (conv && conv.messages.length === 1 && conv.title === 'New chat') {
      await window.electronAPI.renameChatConversation(convId, input.trim().slice(0, 50))
      await loadConversations()
    }

    const messages = (conv?.messages || []).map(m => ({ role: m.role, content: m.content }))

    // Get memory count for context indicator
    try {
      const count = await window.electronAPI.getMemoryCountForChat(messages)
      setMemoryCount(count)
    } catch { /* ignore */ }

    setInput('')
    setStreaming(true)
    streamTextRef.current = ''
    setStreamText('')

    const systemPrompt = settings?.systemPromptMode === 'context' ? undefined :
                          settings?.systemPromptMode === 'custom' ? settings.customSystemPrompt : undefined

    await window.electronAPI.chatSendMessage(convId, messages, systemPrompt)
  }

  const handleAbort = async () => {
    await window.electronAPI.chatAbort()
    // Save partial response if any
    if (streamTextRef.current && activeConvId) {
      const msg: ChatMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'assistant',
        content: streamTextRef.current + '\n\n*[Response stopped]*',
        timestamp: new Date().toISOString()
      }
      await window.electronAPI.addChatMessage(activeConvId, msg)
      await loadConversations()
    }
    streamTextRef.current = ''
    setStreamText('')
    setStreaming(false)
  }

  const handleSaveSettings = async (updates: Partial<ChatSettings>) => {
    const s = await window.electronAPI.saveChatSettings(updates)
    setSettings(s)
  }

  const handleExtractMemories = async () => {
    if (!activeConvId || extractingMemories) return
    setExtractingMemories(true)
    setExtractedCount(null)
    try {
      const created = await window.electronAPI.extractMemoriesFromChat(activeConvId)
      setExtractedCount(created.length)
      setTimeout(() => setExtractedCount(null), 3000)
    } catch { /* ignore */ }
    setExtractingMemories(false)
  }

  const canExtractMemories = activeConvId && activeConv && activeConv.messages.length >= 2

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex relative">
      {/* Sidebar overlay */}
      {showSidebar && (
        <div className="absolute inset-0 z-20 flex">
          <div className="w-56 bg-surface-1 border-r border-white/[0.06] flex flex-col h-full">
            <div className="p-2 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-medium text-white/70">Conversations</span>
              <button onClick={handleNewConversation} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {conversations.map(c => (
                <div
                  key={c.id}
                  className={`group flex items-center px-2 py-1.5 cursor-pointer transition-all ${
                    c.id === activeConvId ? 'bg-surface-3' : 'hover:bg-surface-2'
                  }`}
                  onClick={() => { setActiveConvId(c.id); setShowSidebar(false) }}
                >
                  {renameId === c.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(c.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(c.id); if (e.key === 'Escape') setRenameId(null) }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-surface-3 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white/90 outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-[11px] text-white/70 truncate">{c.title}</span>
                  )}
                  <div className="hidden group-hover:flex gap-0.5 ml-1">
                    <button
                      onClick={e => { e.stopPropagation(); setRenameId(c.id); setRenameValue(c.title) }}
                      className="p-0.5 rounded hover:bg-surface-4 text-muted"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteConversation(c.id) }}
                      className="p-0.5 rounded hover:bg-surface-4 text-muted hover:text-accent-red"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowSidebar(false)} />
        </div>
      )}

      {/* Settings panel */}
      {showSettings && settings && (
        <div className="absolute inset-0 z-20 bg-surface-0/95 flex flex-col p-4 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-white/80">Chat Settings</span>
            <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <label className="block text-[10px] uppercase tracking-widest text-muted font-medium mb-1.5">Model</label>
          <select
            value={settings.model}
            onChange={e => handleSaveSettings({ model: e.target.value })}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 mb-4"
          >
            <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            <option value="claude-opus-4-6">Claude Opus 4.6</option>
          </select>

          <label className="block text-[10px] uppercase tracking-widest text-muted font-medium mb-1.5">System Prompt</label>
          <div className="flex gap-1 mb-2">
            {(['default', 'context', 'custom'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleSaveSettings({ systemPromptMode: mode })}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                  settings.systemPromptMode === mode ? 'bg-surface-4 text-white' : 'bg-surface-2 text-muted hover:text-white/60'
                }`}
              >
                {mode === 'default' ? 'Default' : mode === 'context' ? 'Context-aware' : 'Custom'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted/60 mb-3">
            {settings.systemPromptMode === 'default' && 'Basic helpful assistant prompt'}
            {settings.systemPromptMode === 'context' && 'Includes your tasks, streak, and notes for personalized responses'}
            {settings.systemPromptMode === 'custom' && 'Write your own system prompt below'}
          </p>
          {settings.systemPromptMode === 'custom' && (
            <textarea
              value={settings.customSystemPrompt || ''}
              onChange={e => handleSaveSettings({ customSystemPrompt: e.target.value })}
              placeholder="Enter custom system prompt..."
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 mb-4 h-24 resize-none"
            />
          )}

          <label className="block text-[10px] uppercase tracking-widest text-muted font-medium mb-1.5">Max Tokens</label>
          <input
            type="number"
            value={settings.maxTokens}
            onChange={e => handleSaveSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40"
          />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="flex-1 text-[11px] text-white/70 truncate">
            {activeConv?.title || 'New chat'}
          </span>
          {/* Extract memories from this chat */}
          {canExtractMemories && (
            <button
              onClick={handleExtractMemories}
              disabled={extractingMemories}
              className="p-1 rounded hover:bg-surface-3 text-muted hover:text-accent-purple transition-all relative disabled:opacity-50"
              title="Extract memories from this conversation"
            >
              {extractingMemories ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              )}
              {extractedCount !== null && (
                <span className="absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-accent-purple text-[7px] text-white font-bold min-w-[14px] text-center leading-none">
                  {extractedCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={handleNewConversation}
            className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
          {!activeConv || activeConv.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-[11px] text-muted mb-1">Start a conversation with Claude</p>
              <p className="text-[10px] text-muted/50">Messages are saved locally</p>
            </div>
          ) : (
            <>
              {activeConv.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent-blue/20 text-white/90'
                      : 'bg-surface-2 text-white/80'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {msg.tokenUsage && (
                      <div className="text-[9px] text-muted/40 mt-1">
                        {msg.tokenUsage.input + msg.tokenUsage.output} tokens
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streaming && streamText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed bg-surface-2 text-white/80">
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }} />
                    <span className="inline-block w-1.5 h-3.5 bg-accent-blue/60 animate-pulse ml-0.5" />
                  </div>
                </div>
              )}
              {streaming && !streamText && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3 py-2 bg-surface-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Smart Query response panel (Feature 4) */}
        {(smartQueryText || smartQueryStreaming) && (
          <div className="px-3 py-2">
            <div className="rounded-xl border border-accent-purple/20 bg-accent-purple/5 p-3 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-accent-purple uppercase tracking-wider">Insights</span>
                {!smartQueryStreaming && (
                  <button
                    onClick={() => { setSmartQueryText(''); setSmartQueryId(null); smartQueryTextRef.current = '' }}
                    className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <div className="text-[12px] text-white/80 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(smartQueryText) }} />
                {smartQueryStreaming && <span className="inline-block w-1.5 h-3.5 bg-accent-purple/60 animate-pulse ml-0.5" />}
              </div>
            </div>
          </div>
        )}

        {/* Insights quick-action buttons (Feature 4) */}
        {!activeConv && !smartQueryText && !smartQueryStreaming && (
          <div className="px-3 py-2">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[
                'What should I prioritize this week?',
                'How am I progressing on my goals?',
                'What have I been neglecting?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => handleSmartQuery(q)}
                  disabled={smartQueryStreaming}
                  className="px-3 py-1.5 rounded-lg border border-accent-purple/20 bg-accent-purple/5 text-accent-purple text-[10px] font-medium hover:bg-accent-purple/15 transition-all disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="px-3 pb-3 pt-1">
          <div className="flex gap-2 items-end bg-surface-2 rounded-xl border border-white/[0.06] p-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              className="flex-1 bg-transparent text-[12px] text-white/90 placeholder-muted/40 resize-none outline-none max-h-24 leading-relaxed"
              style={{ minHeight: '20px' }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 96) + 'px'
              }}
            />
            {streaming ? (
              <button
                onClick={handleAbort}
                className="shrink-0 w-7 h-7 rounded-lg bg-accent-red/20 hover:bg-accent-red/30 flex items-center justify-center transition-all"
              >
                <svg className="w-3 h-3 text-accent-red" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 w-7 h-7 rounded-lg bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 flex items-center justify-center transition-all"
              >
                <svg className="w-3 h-3 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
          {settings && (
            <div className="flex items-center justify-between mt-1 px-1">
              <div className="flex items-center gap-1.5">
                <select
                  value={settings.model}
                  onChange={e => handleSaveSettings({ model: e.target.value })}
                  className="bg-surface-2 text-[9px] text-muted/60 hover:text-white/60 outline-none cursor-pointer appearance-none pr-3 rounded px-1 py-0.5 transition-colors [&>option]:bg-surface-2 [&>option]:text-white/80"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.25)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
                >
                  <option value="claude-sonnet-4-5-20250929">Sonnet 4.5</option>
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
                  <option value="claude-opus-4-6">Opus 4.6</option>
                </select>
                {settings.systemPromptMode === 'context' && (
                  <span className="text-[9px] text-muted/40">· Context</span>
                )}
                {memoryCount > 0 && settings.systemPromptMode === 'context' && (
                  <span className="text-[9px] text-accent-purple/60">· {memoryCount} {memoryCount === 1 ? 'memory' : 'memories'}</span>
                )}
              </div>
              <span className="text-[9px] text-muted/40">Shift+Enter for newline</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
