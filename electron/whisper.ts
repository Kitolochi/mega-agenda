import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// Types for the Whisper pipeline
type WhisperPipeline = (audio: Float32Array, options?: { language?: string; task?: string }) => Promise<{ text: string }>

// Module state
let pipeline: WhisperPipeline | null = null
let loadingPromise: Promise<void> | null = null
let status: WhisperStatus = { ready: false, loading: false, error: null, progress: 0 }

export interface WhisperStatus {
  ready: boolean
  loading: boolean
  error: string | null
  progress: number // 0-100
}

export function getWhisperStatus(): WhisperStatus {
  return { ...status }
}

export async function initWhisperModel(onProgress?: (progress: number) => void): Promise<void> {
  if (status.ready || loadingPromise) return loadingPromise || Promise.resolve()

  loadingPromise = (async () => {
    status = { ready: false, loading: true, error: null, progress: 0 }

    try {
      // Share cache directory with embeddings model
      const cacheDir = path.join(app.getPath('userData'), 'models')
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
      process.env.TRANSFORMERS_CACHE = cacheDir

      // Dynamic import to allow graceful failure
      const { pipeline: createPipeline } = await import('@xenova/transformers') as any

      status.progress = 10
      onProgress?.(10)

      // Load whisper-tiny.en — ~39MB, English-only, fastest variant
      pipeline = await createPipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        cache_dir: cacheDir,
        progress_callback: (info: any) => {
          if (info.status === 'progress' && info.progress) {
            const p = Math.round(10 + (info.progress * 0.8))
            status.progress = p
            onProgress?.(p)
          }
        }
      })

      status = { ready: true, loading: false, error: null, progress: 100 }
      onProgress?.(100)
      console.log('Whisper model ready (whisper-tiny.en)')
    } catch (err: any) {
      const msg = err?.message || 'Failed to load Whisper model'
      console.error('Whisper model failed to load:', msg)
      status = { ready: false, loading: false, error: msg, progress: 0 }
      pipeline = null
    }
  })()

  return loadingPromise
}

export async function transcribeAudio(audioData: Float32Array): Promise<string> {
  if (!pipeline) {
    throw new Error('Whisper model not loaded')
  }

  try {
    const result = await pipeline(audioData, { language: 'en', task: 'transcribe' })
    return (result.text || '').trim()
  } catch (err: any) {
    console.error('Whisper transcription failed:', err)
    throw new Error('Transcription failed: ' + (err?.message || 'unknown error'))
  }
}
