import { useState, useEffect, useRef, useCallback } from 'react'
import { VoiceCommand, Category } from '../types'

interface VoiceButtonProps {
  categories: Category[]
  onCommand: (command: VoiceCommand) => void
  listeningRef: React.MutableRefObject<boolean>
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error'

const TAB_KEYWORDS: Record<string, string> = {
  dashboard: 'dashboard', dash: 'dashboard', home: 'dashboard',
  tasks: 'tasks', task: 'tasks',
  journal: 'notes', notes: 'notes', note: 'notes', diary: 'notes',
  feed: 'feed', news: 'feed', rss: 'feed',
}

function localFallback(transcript: string): VoiceCommand | null {
  const lower = transcript.toLowerCase().trim()

  // Navigation: "go to feed", "show dashboard", "open journal"
  const navMatch = lower.match(/(?:go\s+to|show|open|switch\s+to)\s+(\w+)/)
  if (navMatch) {
    const tab = TAB_KEYWORDS[navMatch[1]]
    if (tab) return { action: 'switch_tab', tab }
  }

  // Direct tab name
  for (const [keyword, tab] of Object.entries(TAB_KEYWORDS)) {
    if (lower === keyword) return { action: 'switch_tab', tab }
  }

  // "new task" / "add task" with no details
  if (/^(new|add)\s+task$/.test(lower)) {
    return { action: 'open_modal' }
  }

  return null
}

export default function VoiceButton({ categories, onCommand, listeningRef }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [statusText, setStatusText] = useState('')
  const recognitionRef = useRef<any>(null)
  const apiKeyRef = useRef<string>('')

  useEffect(() => {
    window.electronAPI.getClaudeApiKey().then(key => { apiKeyRef.current = key || '' })
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    setState('idle')
    setTranscript('')
    setStatusText('')
    listeningRef.current = false
  }, [listeningRef])

  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) {
      stopListening()
      return
    }

    // Try local fallback first
    const local = localFallback(text)
    if (local) {
      setState('success')
      setStatusText(getActionLabel(local))
      onCommand(local)
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 1200)
      listeningRef.current = false
      return
    }

    // If no API key, show message
    if (!apiKeyRef.current) {
      setState('error')
      setStatusText('Add Claude API key for full voice control')
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2500)
      listeningRef.current = false
      return
    }

    // Use Claude to parse
    setState('processing')
    setStatusText('Understanding...')
    try {
      const categoryNames = categories.map(c => c.name)
      const command = await window.electronAPI.parseVoiceCommand(apiKeyRef.current, text, categoryNames)
      if (command.action === 'unknown') {
        setState('error')
        setStatusText("Didn't understand that")
        setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
      } else {
        setState('success')
        setStatusText(getActionLabel(command))
        onCommand(command)
        setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 1500)
      }
    } catch {
      setState('error')
      setStatusText('Voice parsing failed')
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
    }
    listeningRef.current = false
  }, [categories, onCommand, stopListening, listeningRef])

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognition) {
      setState('error')
      setStatusText('Speech recognition not supported')
      setTimeout(() => { setState('idle'); setStatusText('') }, 2000)
      return
    }

    // Refresh API key
    window.electronAPI.getClaudeApiKey().then(key => { apiKeyRef.current = key || '' })

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }
      setTranscript(final || interim)
      if (final) {
        processTranscript(final)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return
      setState('error')
      setStatusText(event.error === 'no-speech' ? 'No speech detected' : 'Mic error')
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
      listeningRef.current = false
    }

    recognition.onend = () => {
      // If still in listening state (no result came), reset
      if (recognitionRef.current) {
        recognitionRef.current = null
        if (state === 'listening') {
          setState('idle')
          setTranscript('')
          listeningRef.current = false
        }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('listening')
    setTranscript('')
    setStatusText('')
    listeningRef.current = true
  }, [processTranscript, state, listeningRef])

  const toggle = useCallback(() => {
    if (state === 'listening') {
      stopListening()
    } else if (state === 'idle') {
      startListening()
    }
  }, [state, startListening, stopListening])

  // Expose toggle via ref for keyboard shortcut
  useEffect(() => {
    (window as any).__voiceToggle = toggle
    return () => { delete (window as any).__voiceToggle }
  }, [toggle])

  return (
    <>
      {/* Mic button — rendered inline (parent places it in title bar) */}
      <button
        onClick={toggle}
        disabled={state === 'processing'}
        className={`no-drag w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 ${
          state === 'listening'
            ? 'bg-accent-rose/20 ring-1.5 ring-accent-rose animate-voice-pulse'
            : state === 'processing'
            ? 'bg-surface-3 cursor-wait'
            : state === 'success'
            ? 'bg-accent-emerald/20'
            : state === 'error'
            ? 'bg-accent-red/20'
            : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'
        }`}
        title="Voice command (V)"
      >
        {state === 'processing' ? (
          <svg className="w-3 h-3 text-white/60 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : state === 'success' ? (
          <svg className="w-3 h-3 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={`w-3 h-3 ${state === 'listening' ? 'text-accent-rose' : 'text-current'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
          </svg>
        )}
      </button>

      {/* Transcript / Status banner — absolutely positioned below title bar */}
      {(transcript || statusText) && (
        <div className="absolute top-[41px] left-0 right-0 z-50 flex justify-center pointer-events-none animate-fade-in">
          <div className="bg-surface-2/95 backdrop-blur-md border border-white/[0.06] rounded-b-lg px-3 py-1.5 max-w-[280px] shadow-lg">
            {transcript && state === 'listening' && (
              <p className="text-xs text-white/80 leading-relaxed text-center">{transcript}</p>
            )}
            {statusText && (
              <p className={`text-xs font-medium leading-relaxed text-center ${
                state === 'success' ? 'text-accent-emerald' :
                state === 'error' ? 'text-accent-red' :
                'text-white/60'
              }`}>{statusText}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function getActionLabel(cmd: VoiceCommand): string {
  switch (cmd.action) {
    case 'add_task': return `Adding task${cmd.category ? ` to ${cmd.category}` : ''}...`
    case 'complete_task': return `Completing "${cmd.title}"...`
    case 'switch_tab': return `Opening ${cmd.tab}...`
    case 'open_modal': return 'Opening new task...'
    case 'add_note': return 'Adding journal note...'
    case 'summarize_feed': return 'Opening feed...'
    default: return 'Done'
  }
}
