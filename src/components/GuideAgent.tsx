import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { renderMarkdown } from '../utils/markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function GuideAgent() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamText, scrollToBottom])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    const unsubChunk = window.electronAPI.onGuideChatChunk(({ text }) => {
      setStreamText(prev => prev + text)
    })
    const unsubEnd = window.electronAPI.onGuideChatEnd(() => {
      setStreamText(prev => {
        if (prev) {
          setMessages(msgs => [...msgs, { role: 'assistant', content: prev }])
        }
        return ''
      })
      setStreaming(false)
    })
    const unsubError = window.electronAPI.onGuideChatError(({ error }) => {
      setStreamText('')
      setMessages(msgs => [...msgs, { role: 'assistant', content: `Error: ${error}` }])
      setStreaming(false)
    })

    return () => { unsubChunk(); unsubEnd(); unsubError() }
  }, [])

  const send = useCallback(() => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)
    setStreamText('')

    window.electronAPI.guideChatSend(
      newMessages.map(m => ({ role: m.role, content: m.content }))
    )
  }, [input, streaming, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleClose = () => {
    if (streaming) {
      window.electronAPI.guideChatAbort()
    }
    setOpen(false)
    setMessages([])
    setStreamText('')
    setStreaming(false)
    setInput('')
  }

  return createPortal(
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[380px] h-[520px] bg-surface-1 border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface-2/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white/90">Guide Agent</span>
            </div>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="text-center text-muted text-xs mt-8 space-y-2">
                <p className="text-sm text-white/60">Ask me anything about Mega Agenda</p>
                <p>Features, workflows, shortcuts, setup, or architecture</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent-blue/20 text-white/90'
                      : 'bg-surface-2 text-white/80'
                  }`}
                  dangerouslySetInnerHTML={
                    msg.role === 'assistant'
                      ? { __html: renderMarkdown(msg.content) }
                      : undefined
                  }
                >
                  {msg.role === 'user' ? msg.content : undefined}
                </div>
              </div>
            ))}

            {streaming && streamText && (
              <div className="flex justify-start">
                <div
                  className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-surface-2 text-white/80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }}
                />
              </div>
            )}

            {streaming && !streamText && (
              <div className="flex justify-start">
                <div className="bg-surface-2 rounded-xl px-3 py-2 text-xs text-muted">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/10">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="flex-1 bg-surface-3 rounded-xl px-3 py-2 text-xs text-white placeholder-muted border border-white/5 focus:border-accent-blue/50 focus:outline-none resize-none"
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white disabled:opacity-30 hover:scale-105 active:scale-95 transition-all shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB toggle */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shadow-accent-purple/20"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        )}
      </button>
    </>,
    document.body
  )
}
