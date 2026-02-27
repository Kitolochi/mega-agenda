import { useState, useEffect, useRef, useCallback } from 'react'
import { VoiceCommand, Category, WhisperStatus } from '../types'

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

const MIC_STORAGE_KEY = 'voice-selected-mic-id'

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

const MAX_RECORDING_MS = 8000

export default function VoiceButton({ categories, onCommand, listeningRef }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [statusText, setStatusText] = useState('')
  const [whisperReady, setWhisperReady] = useState(false)
  const [whisperLoading, setWhisperLoading] = useState(true)
  const apiKeyRef = useRef<string>('')

  // Mic picker state
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() =>
    localStorage.getItem(MIC_STORAGE_KEY) || ''
  )
  const [showMicPicker, setShowMicPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Audio capture refs
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Enumerate audio input devices
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(mics)
      // If saved device is gone, fall back to default
      if (selectedDeviceId && !mics.some(d => d.deviceId === selectedDeviceId)) {
        setSelectedDeviceId('')
        localStorage.removeItem(MIC_STORAGE_KEY)
      }
    } catch {
      // Can't enumerate — will use default
    }
  }, [selectedDeviceId])

  useEffect(() => {
    refreshDevices()
    if (!navigator.mediaDevices) return
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  // Close picker on outside click
  useEffect(() => {
    if (!showMicPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowMicPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMicPicker])

  // Poll whisper status until ready
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const s: WhisperStatus = await window.electronAPI.getWhisperStatus()
        if (cancelled) return
        setWhisperReady(s.ready)
        setWhisperLoading(s.loading)
        if (!s.ready && !s.error) {
          setTimeout(check, 2000)
        }
      } catch {
        if (!cancelled) setTimeout(check, 3000)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    window.electronAPI.getClaudeApiKey().then(key => { apiKeyRef.current = key || '' })
  }, [])

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }, [])

  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim()) {
      setState('error')
      setStatusText('No speech detected')
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
      listeningRef.current = false
      return
    }

    setTranscript(text)

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
  }, [categories, onCommand, listeningRef])

  const stopAndTranscribe = useCallback(async () => {
    cleanup()

    const chunks = chunksRef.current
    chunksRef.current = []

    if (chunks.length === 0) {
      setState('error')
      setStatusText('No speech detected')
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
      listeningRef.current = false
      return
    }

    // Concatenate all chunks into a single Float32Array
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    const audioData = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      audioData.set(chunk, offset)
      offset += chunk.length
    }

    // Transcribe via Whisper
    setState('processing')
    setStatusText('Transcribing...')
    try {
      const text = await window.electronAPI.transcribeAudio(Array.from(audioData))
      await processTranscript(text)
    } catch (err: any) {
      setState('error')
      setStatusText('Transcription failed')
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
      listeningRef.current = false
    }
  }, [cleanup, processTranscript, listeningRef])

  const stopListening = useCallback(() => {
    if (state === 'listening') {
      stopAndTranscribe()
    } else {
      cleanup()
      setState('idle')
      setTranscript('')
      setStatusText('')
      listeningRef.current = false
    }
  }, [state, stopAndTranscribe, cleanup, listeningRef])

  const startListening = useCallback(async () => {
    if (!whisperReady || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setStatusText(!navigator.mediaDevices ? 'Mic not available' : whisperLoading ? 'Loading voice...' : 'Voice not available')
      setTimeout(() => { setState('idle'); setStatusText('') }, 2000)
      return
    }

    // Refresh API key
    window.electronAPI.getClaudeApiKey().then(key => { apiKeyRef.current = key || '' })

    // Build audio constraints with selected device
    const audioConstraints: MediaTrackConstraints = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId } }
      : true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      mediaStreamRef.current = stream

      // Create AudioContext at 16kHz (Whisper's expected sample rate)
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)

      // ScriptProcessor to collect raw PCM chunks
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      chunksRef.current = []

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(inputData))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setState('listening')
      setTranscript('')
      setStatusText('')
      listeningRef.current = true

      // Auto-stop after 8 seconds
      timeoutRef.current = setTimeout(() => {
        stopAndTranscribe()
      }, MAX_RECORDING_MS)
    } catch (err: any) {
      setState('error')
      if (err?.name === 'NotAllowedError') {
        setStatusText('Mic access denied')
      } else if (err?.name === 'OverconstrainedError') {
        // Selected mic was disconnected mid-session — clear and retry with default
        setSelectedDeviceId('')
        localStorage.removeItem(MIC_STORAGE_KEY)
        setStatusText('Mic disconnected, using default')
      } else {
        setStatusText('Mic error')
      }
      setTimeout(() => { setState('idle'); setTranscript(''); setStatusText('') }, 2000)
      listeningRef.current = false
    }
  }, [whisperReady, whisperLoading, selectedDeviceId, stopAndTranscribe, listeningRef])

  const toggle = useCallback(() => {
    if (state === 'listening') {
      stopListening()
    } else if (state === 'idle') {
      startListening()
    }
  }, [state, startListening, stopListening])

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (deviceId) {
      localStorage.setItem(MIC_STORAGE_KEY, deviceId)
    } else {
      localStorage.removeItem(MIC_STORAGE_KEY)
    }
    setShowMicPicker(false)
  }, [])

  // Expose toggle via ref for keyboard shortcut
  useEffect(() => {
    (window as any).__voiceToggle = toggle
    return () => { delete (window as any).__voiceToggle }
  }, [toggle])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  const isDisabled = state === 'processing' || (!whisperReady && !whisperLoading)

  // Label for the currently selected mic
  const selectedMicLabel = audioDevices.find(d => d.deviceId === selectedDeviceId)?.label
  const activeMicName = selectedMicLabel
    ? (selectedMicLabel.length > 30 ? selectedMicLabel.slice(0, 28) + '...' : selectedMicLabel)
    : null

  return (
    <>
      {/* Mic button — rendered inline (parent places it in title bar) */}
      <div className="relative">
        <button
          onClick={toggle}
          onContextMenu={(e) => {
            e.preventDefault()
            refreshDevices()
            setShowMicPicker(p => !p)
          }}
          disabled={isDisabled}
          className={`no-drag w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 ${
            state === 'listening'
              ? 'bg-accent-rose/20 ring-1.5 ring-accent-rose animate-voice-pulse'
              : state === 'processing'
              ? 'bg-surface-3 cursor-wait'
              : state === 'success'
              ? 'bg-accent-emerald/20'
              : state === 'error'
              ? 'bg-accent-red/20'
              : isDisabled
              ? 'opacity-30 cursor-not-allowed'
              : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'
          }`}
          title={whisperReady
            ? `Voice command (V)${activeMicName ? `\nMic: ${activeMicName}` : ''}\nRight-click to change mic`
            : whisperLoading ? 'Voice loading...' : 'Voice not available'}
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

        {/* Mic device picker popover */}
        {showMicPicker && (
          <div
            ref={pickerRef}
            className="absolute top-full right-0 mt-1 z-[60] w-64 bg-surface-2 border border-white/[0.08] rounded-lg shadow-xl overflow-hidden animate-fade-in"
          >
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Microphone</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {/* System default option */}
              <button
                onClick={() => selectDevice('')}
                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                  !selectedDeviceId
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                }`}
              >
                {!selectedDeviceId && (
                  <svg className="w-3 h-3 text-accent-emerald shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className={!selectedDeviceId ? '' : 'pl-5'}>System Default</span>
              </button>

              {audioDevices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => selectDevice(device.deviceId)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                    selectedDeviceId === device.deviceId
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                  }`}
                >
                  {selectedDeviceId === device.deviceId && (
                    <svg className="w-3 h-3 text-accent-emerald shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className={selectedDeviceId === device.deviceId ? '' : 'pl-5'}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </span>
                </button>
              ))}

              {audioDevices.length === 0 && (
                <p className="px-3 py-2 text-xs text-white/30 italic">No microphones found</p>
              )}
            </div>
          </div>
        )}
      </div>

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
