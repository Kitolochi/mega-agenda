import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFileSync } from 'child_process'

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

/** Decode a webm/opus blob to 16 kHz mono PCM using ffmpeg, then transcribe */
export async function transcribeAudioBlob(webmBytes: Uint8Array): Promise<string> {
  if (!pipeline) {
    throw new Error('Whisper model not loaded')
  }

  // Resolve ffmpeg binary from ffmpeg-static
  let ffmpegPath: string
  try {
    ffmpegPath = require('ffmpeg-static')
  } catch {
    throw new Error('ffmpeg-static not installed')
  }

  const tmpDir = app.getPath('temp')
  const ts = Date.now()
  const tmpIn = path.join(tmpDir, `voice-${ts}.webm`)
  const tmpOut = path.join(tmpDir, `voice-${ts}.raw`)

  try {
    fs.writeFileSync(tmpIn, Buffer.from(webmBytes))

    // Convert webm → raw 32-bit float PCM, 16 kHz, mono
    execFileSync(ffmpegPath, [
      '-i', tmpIn,
      '-f', 'f32le',
      '-acodec', 'pcm_f32le',
      '-ar', '16000',
      '-ac', '1',
      tmpOut,
      '-y',
    ], { stdio: 'pipe', timeout: 15000 })

    const rawBytes = fs.readFileSync(tmpOut)
    const pcm = new Float32Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength / 4)

    if (pcm.length === 0) {
      throw new Error('No audio data after decoding')
    }

    const result = await pipeline(pcm, { language: 'en', task: 'transcribe' })
    return (result.text || '').trim()
  } catch (err: any) {
    console.error('Blob transcription failed:', err)
    throw new Error('Transcription failed: ' + (err?.message || 'unknown error'))
  } finally {
    try { fs.unlinkSync(tmpIn) } catch {}
    try { fs.unlinkSync(tmpOut) } catch {}
  }
}
