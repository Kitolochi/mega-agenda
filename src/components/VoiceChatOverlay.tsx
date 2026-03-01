import { useEffect, useRef } from 'react'
import { useVoiceChat } from '../hooks/useVoiceChat'

interface VoiceChatOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export default function VoiceChatOverlay({ isOpen, onClose }: VoiceChatOverlayProps) {
  const {
    state,
    messages,
    currentTranscript,
    currentResponse,
    error,
    toggleMic,
    pause,
    interrupt,
    cleanup,
  } = useVoiceChat(isOpen)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse, currentTranscript])

  if (!isOpen) return null

  const handleClose = () => {
    cleanup()
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ top: '41px' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="relative w-[360px] max-h-[80vh] glass-card rounded-2xl flex flex-col animate-overlay-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-accent-rose/30 to-accent-purple/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-accent-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-white/80">Voice Chat</span>
            {state !== 'idle' && (
              <span className="text-[9px] text-muted/60 capitalize">{state}</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-6 h-6 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-2.5 min-h-[120px] max-h-[45vh]">
          {messages.length === 0 && !currentTranscript && !currentResponse && (
            <div className="flex flex-col items-center justify-center h-full text-center py-6">
              <p className="text-[11px] text-muted/60">Speak naturally to have a conversation</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent-rose/15 text-white/90'
                  : 'bg-surface-3 text-white/80'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {/* Current transcript being processed */}
          {currentTranscript && state === 'transcribing' && (
            <div className="flex justify-end animate-slide-up">
              <div className="max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed bg-accent-rose/15 text-white/70">
                {currentTranscript}
              </div>
            </div>
          )}

          {/* Streaming response */}
          {currentResponse && (
            <div className="flex justify-start animate-slide-up">
              <div className="max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed bg-surface-3 text-white/80">
                <div className="whitespace-pre-wrap">{currentResponse}</div>
                {state === 'thinking' && (
                  <span className="inline-block w-1.5 h-3.5 bg-accent-blue/60 animate-pulse ml-0.5" />
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-1.5 bg-accent-red/10 border-t border-accent-red/20">
            <p className="text-[10px] text-accent-red text-center">{error}</p>
          </div>
        )}

        {/* State Indicator + Controls */}
        <div className="px-4 py-4 border-t border-white/[0.06] flex flex-col items-center gap-3">
          {/* Animated state indicator */}
          <StateIndicator state={state} />

          {/* Control buttons */}
          <div className="flex items-center gap-3">
            {/* Pause button */}
            <button
              onClick={pause}
              disabled={state === 'idle'}
              className="w-9 h-9 rounded-full bg-surface-3 hover:bg-surface-4 disabled:opacity-30 flex items-center justify-center text-white/50 hover:text-white/80 transition-all"
              title="Pause conversation"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>

            {/* Main mic button */}
            <button
              onClick={state === 'speaking' ? interrupt : toggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                state === 'listening'
                  ? 'bg-accent-rose/20 ring-2 ring-accent-rose/50 animate-voice-pulse'
                  : state === 'speaking'
                  ? 'bg-accent-emerald/20 ring-2 ring-accent-emerald/50 hover:bg-accent-rose/20 hover:ring-accent-rose/50'
                  : state === 'transcribing' || state === 'thinking'
                  ? 'bg-surface-3 cursor-wait'
                  : 'bg-surface-3 hover:bg-surface-4'
              }`}
              title={
                state === 'listening' ? 'Click to stop recording'
                : state === 'speaking' ? 'Click to interrupt'
                : state === 'transcribing' ? 'Transcribing...'
                : state === 'thinking' ? 'Thinking...'
                : 'Click to start talking'
              }
            >
              {state === 'transcribing' || state === 'thinking' ? (
                <svg className="w-5 h-5 text-white/40 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : state === 'speaking' ? (
                <svg className="w-5 h-5 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              ) : (
                <svg className={`w-5 h-5 ${state === 'listening' ? 'text-accent-rose' : 'text-white/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                </svg>
              )}
            </button>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-surface-3 hover:bg-accent-red/20 flex items-center justify-center text-white/50 hover:text-accent-red transition-all"
              title="Close voice chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Animated state indicator circle */
function StateIndicator({ state }: { state: string }) {
  if (state === 'listening') {
    return (
      <div className="relative w-8 h-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent-rose/20 animate-ping" />
        <div className="absolute inset-1 rounded-full bg-accent-rose/30 animate-pulse" />
        <div className="relative w-3 h-3 rounded-full bg-accent-rose" />
      </div>
    )
  }

  if (state === 'transcribing') {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <svg className="w-5 h-5 text-accent-amber animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (state === 'thinking') {
    return (
      <div className="w-8 h-8 flex items-center justify-center gap-1">
        <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    )
  }

  if (state === 'speaking') {
    return (
      <div className="w-8 h-8 flex items-center justify-center gap-[3px]">
        <span className="w-[3px] h-4 bg-accent-emerald rounded-full animate-speak-wave" style={{ animationDelay: '0ms' }} />
        <span className="w-[3px] h-4 bg-accent-emerald rounded-full animate-speak-wave" style={{ animationDelay: '200ms' }} />
        <span className="w-[3px] h-4 bg-accent-emerald rounded-full animate-speak-wave" style={{ animationDelay: '400ms' }} />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="w-8 h-8 flex items-center justify-center">
        <svg className="w-5 h-5 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    )
  }

  // idle
  return (
    <div className="w-8 h-8 flex items-center justify-center">
      <div className="w-3 h-3 rounded-full bg-surface-4 border border-white/10" />
    </div>
  )
}
