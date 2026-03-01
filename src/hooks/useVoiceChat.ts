import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceChatState, VoiceChatMessage, ChatMessage } from '../types'
import { speakText, cancelSpeech } from '../utils/tts'

const MAX_RECORDING_MS = 30000
const MAX_EMPTY_TRANSCRIPTS = 3
const MIC_STORAGE_KEY = 'voice-selected-mic-id'

export interface UseVoiceChatReturn {
  state: VoiceChatState
  messages: VoiceChatMessage[]
  currentTranscript: string
  currentResponse: string
  error: string | null
  startListening: () => void
  stopListening: () => void
  toggleMic: () => void
  pause: () => void
  interrupt: () => void
  cleanup: () => void
}

export function useVoiceChat(isOpen: boolean): UseVoiceChatReturn {
  const [state, setState] = useState<VoiceChatState>('idle')
  const [messages, setMessages] = useState<VoiceChatMessage[]>([])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [currentResponse, setCurrentResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Refs for media/recording
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs for conversation
  const conversationIdRef = useRef<string | null>(null)
  const streamTextRef = useRef('')
  const emptyCountRef = useRef(0)
  const pausedRef = useRef(false)
  const stateRef = useRef<VoiceChatState>('idle')

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state }, [state])

  // --- Cleanup helpers ---
  const stopMedia = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch {}
    }
    recorderRef.current = null
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    stopMedia()
    cancelSpeech()
    window.electronAPI.chatAbort().catch(() => {})
    setState('idle')
    setCurrentTranscript('')
    setCurrentResponse('')
    streamTextRef.current = ''
    pausedRef.current = false
    emptyCountRef.current = 0
  }, [stopMedia])

  // --- Stream listeners (set up once per conversation) ---
  useEffect(() => {
    const cleanupChunk = window.electronAPI.onChatStreamChunk((data) => {
      if (data.conversationId === conversationIdRef.current) {
        streamTextRef.current += data.text
        setCurrentResponse(streamTextRef.current)
      }
    })

    const cleanupEnd = window.electronAPI.onChatStreamEnd(async (data) => {
      if (data.conversationId !== conversationIdRef.current) return
      const finalText = streamTextRef.current

      // Persist assistant message
      const msg: ChatMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'assistant',
        content: finalText,
        timestamp: new Date().toISOString(),
        model: data.model,
        tokenUsage: { input: data.usage.input, output: data.usage.output }
      }
      await window.electronAPI.addChatMessage(data.conversationId, msg)

      // Add to local messages
      setMessages(prev => [...prev, { role: 'assistant', content: finalText, timestamp: msg.timestamp }])
      streamTextRef.current = ''

      // Speak response
      if (finalText.trim()) {
        setState('speaking')
        speakText(finalText, () => {
          // TTS finished — auto-continue if not paused
          if (!pausedRef.current) {
            // Need to check via a timeout to let React update
            setTimeout(() => {
              if (!pausedRef.current && stateRef.current === 'speaking') {
                startListeningInternal()
              }
            }, 300)
          } else {
            setState('idle')
          }
        }, () => {
          setState('idle')
        })
      } else {
        setState('idle')
      }
    })

    const cleanupError = window.electronAPI.onChatStreamError((data) => {
      if (data.conversationId !== conversationIdRef.current) return
      streamTextRef.current = ''
      setCurrentResponse('')
      setState('error')
      setError('Chat error: ' + data.error)
      setTimeout(() => {
        if (stateRef.current === 'error') setState('idle')
        setError(null)
      }, 3000)
    })

    return () => { cleanupChunk(); cleanupEnd(); cleanupError() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Send transcript to Claude ---
  const sendToChat = useCallback(async (text: string) => {
    setState('thinking')
    setCurrentResponse('')
    streamTextRef.current = ''

    try {
      let convId = conversationIdRef.current
      if (!convId) {
        const conv = await window.electronAPI.createChatConversation('Voice Chat')
        convId = conv.id
        conversationIdRef.current = convId
      }

      // Persist user message
      const userMsg: ChatMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      }
      await window.electronAPI.addChatMessage(convId, userMsg)

      // Get full message history for context
      const conv = await window.electronAPI.getChatConversation(convId)
      const chatMessages = (conv?.messages || []).map(m => ({ role: m.role, content: m.content }))

      // Start streaming
      await window.electronAPI.chatSendMessage(convId, chatMessages)
    } catch (err: any) {
      setState('error')
      setError('Failed to send message')
      setTimeout(() => { setState('idle'); setError(null) }, 3000)
    }
  }, [])

  // --- Recording completed ---
  const handleRecordingComplete = useCallback(async (chunks: Blob[], mimeType: string) => {
    if (chunks.length === 0) {
      emptyCountRef.current++
      if (emptyCountRef.current >= MAX_EMPTY_TRANSCRIPTS) {
        pausedRef.current = true
        setState('idle')
        setError('No speech detected — paused')
        setTimeout(() => setError(null), 3000)
      } else if (!pausedRef.current) {
        // Retry listening
        setTimeout(() => startListeningInternal(), 300)
      } else {
        setState('idle')
      }
      return
    }

    setState('transcribing')
    setCurrentTranscript('')

    try {
      const blob = new Blob(chunks, { type: mimeType })
      const arrayBuffer = await blob.arrayBuffer()
      const bytes = Array.from(new Uint8Array(arrayBuffer))
      const text = await window.electronAPI.transcribeAudioBlob(bytes)

      if (!text.trim()) {
        emptyCountRef.current++
        if (emptyCountRef.current >= MAX_EMPTY_TRANSCRIPTS) {
          pausedRef.current = true
          setState('idle')
          setError('No speech detected — paused')
          setTimeout(() => setError(null), 3000)
        } else if (!pausedRef.current) {
          setTimeout(() => startListeningInternal(), 300)
        } else {
          setState('idle')
        }
        return
      }

      // Got a valid transcript
      emptyCountRef.current = 0
      setCurrentTranscript(text)
      setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }])
      await sendToChat(text)
    } catch (err: any) {
      setState('error')
      setError('Transcription failed')
      setTimeout(() => { setState('idle'); setError(null) }, 3000)
    }
  }, [sendToChat])

  // --- Start/stop listening ---
  const startListeningInternal = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError('Microphone not available')
      setTimeout(() => { setState('idle'); setError(null) }, 3000)
      return
    }

    const selectedDeviceId = localStorage.getItem(MIC_STORAGE_KEY) || ''
    const audioConstraints: MediaTrackConstraints = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId } }
      : {}

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints.deviceId ? audioConstraints : true })
      mediaStreamRef.current = stream

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const recorded = chunksRef.current
        const mime = recorder.mimeType
        chunksRef.current = []
        handleRecordingComplete(recorded, mime)
      }

      recorder.start()
      setState('listening')
      setCurrentTranscript('')
      setError(null)

      timeoutRef.current = setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop()
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop())
          mediaStreamRef.current = null
        }
      }, MAX_RECORDING_MS)
    } catch (err: any) {
      setState('error')
      if (err?.name === 'NotAllowedError') {
        setError('Microphone access denied')
      } else if (err?.name === 'OverconstrainedError') {
        localStorage.removeItem(MIC_STORAGE_KEY)
        setError('Mic disconnected — try again')
      } else {
        setError('Microphone error')
      }
      setTimeout(() => { setState('idle'); setError(null) }, 3000)
    }
  }, [handleRecordingComplete])

  const startListening = useCallback(() => {
    pausedRef.current = false
    emptyCountRef.current = 0
    startListeningInternal()
  }, [startListeningInternal])

  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }, [])

  const toggleMic = useCallback(() => {
    if (state === 'listening') {
      stopListening()
    } else if (state === 'idle') {
      startListening()
    }
  }, [state, startListening, stopListening])

  const pause = useCallback(() => {
    pausedRef.current = true
    cancelSpeech()
    stopMedia()
    setState('idle')
  }, [stopMedia])

  const interrupt = useCallback(() => {
    cancelSpeech()
    if (!pausedRef.current) {
      startListeningInternal()
    } else {
      setState('idle')
    }
  }, [startListeningInternal])

  // Auto-start listening when overlay opens
  useEffect(() => {
    if (isOpen) {
      // Check whisper readiness first
      window.electronAPI.getWhisperStatus().then(status => {
        if (status.ready) {
          startListening()
        } else {
          setError(status.loading ? 'Voice engine loading...' : 'Voice engine not available')
          setTimeout(() => setError(null), 3000)
        }
      }).catch(() => {})
    } else {
      cleanup()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    state,
    messages,
    currentTranscript,
    currentResponse,
    error,
    startListening,
    stopListening,
    toggleMic,
    pause,
    interrupt,
    cleanup,
  }
}
