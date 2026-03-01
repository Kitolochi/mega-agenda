import { useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useChatStreaming } from '../../hooks/useChatStreaming'
import { useSmartQuery } from '../../hooks/useSmartQuery'
import ChatSidebar from './ChatSidebar'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import SmartQueryPanel from './SmartQueryPanel'
import ChatSettingsPanel from './ChatSettingsPanel'

export default function ChatView() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamTextRef = useRef('')
  const smartQueryTextRef = useRef('')

  const {
    showSidebar, showSettings, settings,
    streamText, smartQueryText, smartQueryStreaming,
    loadConversations, loadSettings,
    handleNewConversation, handleExtractMemories,
    setShowSidebar, setShowSettings,
  } = useChatStore()

  const activeConv = useChatStore(s => s.getActiveConv())
  const activeConvId = useChatStore(s => s.activeConvId)
  const extractingMemories = useChatStore(s => s.extractingMemories)
  const extractedCount = useChatStore(s => s.extractedCount)
  const canExtractMemories = activeConvId && activeConv && activeConv.messages.length >= 2

  // Wire up streaming hooks
  useChatStreaming(streamTextRef)
  useSmartQuery(smartQueryTextRef)

  useEffect(() => {
    loadConversations()
    loadSettings()
  }, [loadConversations, loadSettings])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConv?.messages, streamText])

  return (
    <div className="h-full flex relative">
      {/* Sidebar overlay */}
      {showSidebar && <ChatSidebar />}

      {/* Settings panel */}
      {showSettings && settings && <ChatSettingsPanel />}

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
        <ChatMessages messagesEndRef={messagesEndRef} />

        {/* Smart Query response panel */}
        {(smartQueryText || smartQueryStreaming) && (
          <SmartQueryPanel smartQueryTextRef={smartQueryTextRef} />
        )}

        {/* Insights quick-action buttons */}
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
                  onClick={() => useChatStore.getState().handleSmartQuery(q)}
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
        <ChatInput
          inputRef={inputRef}
          streamTextRef={streamTextRef}
          smartQueryTextRef={smartQueryTextRef}
        />
      </div>
    </div>
  )
}
