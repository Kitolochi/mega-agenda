/**
 * Scrapling Python sidecar bridge.
 *
 * Spawns python/scraper_service.py as a child process and communicates
 * via newline-delimited JSON over stdin/stdout.
 */

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { app } from 'electron'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckCommand {
  cmd: 'health_check'
}

export interface ScrapeYelpCommand {
  cmd: 'scrape_yelp'
  category: string
  location?: string
  limit?: number
}

export interface ScrapeDirectoryCommand {
  cmd: 'scrape_directory'
  url: string
}

export interface ScrapeSocialLinksCommand {
  cmd: 'scrape_social_links'
  url: string
}

export interface ScrapeGoogleSearchCommand {
  cmd: 'scrape_google_search'
  query: string
}

export type ScrapingCommand =
  | HealthCheckCommand
  | ScrapeYelpCommand
  | ScrapeDirectoryCommand
  | ScrapeSocialLinksCommand
  | ScrapeGoogleSearchCommand

export interface Business {
  name: string
  url: string
  rating?: string
  phone?: string
  address?: string
  source?: string
}

export interface SocialLinks {
  linkedin: string
  facebook: string
  instagram: string
  twitter: string
}

export interface SearchResult {
  url: string
  title: string
}

export interface HealthCheckResponse {
  ok: boolean
  version: string
}

export interface BusinessesResponse {
  businesses: Business[]
}

export interface SocialLinksResponse {
  social: SocialLinks
}

export interface SearchResultsResponse {
  results: SearchResult[]
}

export interface ErrorResponse {
  error: string
}

export type ScrapingResponse =
  | HealthCheckResponse
  | BusinessesResponse
  | SocialLinksResponse
  | SearchResultsResponse
  | ErrorResponse

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let sidecar: ChildProcess | null = null
let stdoutBuffer = ''
let ready = false
let startingUp = false

const DEFAULT_TIMEOUT = 30_000

type PendingRequest = {
  resolve: (value: ScrapingResponse) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const commandQueue: Array<{
  command: ScrapingCommand
  resolve: (value: ScrapingResponse) => void
  reject: (reason: Error) => void
  timeout: number
}> = []

let currentRequest: PendingRequest | null = null
let processing = false

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPythonPath(): string {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(app.getAppPath(), 'python')

  if (process.platform === 'win32') {
    return path.join(root, '.venv', 'Scripts', 'python.exe')
  }
  return path.join(root, '.venv', 'bin', 'python')
}

function getScriptPath(): string {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'python')
    : path.join(app.getAppPath(), 'python')

  return path.join(root, 'scraper_service.py')
}

function spawnSidecar(): ChildProcess {
  const pythonPath = getPythonPath()
  const scriptPath = getScriptPath()

  console.log(`[scrapling-bridge] spawning: ${pythonPath} ${scriptPath}`)

  const child = spawn(pythonPath, [scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stderr?.on('data', (data: Buffer) => {
    console.error(`[scrapling-bridge] stderr: ${data.toString().trim()}`)
  })

  child.on('error', (err) => {
    console.error('[scrapling-bridge] process error:', err.message)
    handleCrash()
  })

  child.on('exit', (code, signal) => {
    console.log(`[scrapling-bridge] exited code=${code} signal=${signal}`)
    sidecar = null
    ready = false
    handleCrash()
  })

  child.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString()
    processBuffer()
  })

  return child
}

function processBuffer(): void {
  let newlineIdx: number
  while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
    const line = stdoutBuffer.slice(0, newlineIdx).trim()
    stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1)

    if (!line) continue

    let parsed: any
    try {
      parsed = JSON.parse(line)
    } catch {
      console.error('[scrapling-bridge] unparseable stdout line:', line)
      continue
    }

    // Handle the initial ready signal
    if (parsed.ready) {
      console.log(`[scrapling-bridge] sidecar ready, version=${parsed.version}`)
      ready = true
      startingUp = false
      drainQueue()
      continue
    }

    // Deliver to the current pending request
    if (currentRequest) {
      clearTimeout(currentRequest.timer)
      currentRequest.resolve(parsed as ScrapingResponse)
      currentRequest = null
      processing = false
      drainQueue()
    }
  }
}

function handleCrash(): void {
  // Reject the current request if any
  if (currentRequest) {
    clearTimeout(currentRequest.timer)
    currentRequest.reject(new Error('Sidecar process crashed'))
    currentRequest = null
    processing = false
  }

  // Attempt auto-restart if there are queued commands
  if (commandQueue.length > 0 && !startingUp) {
    console.log('[scrapling-bridge] auto-restarting for queued commands...')
    startSidecar()
  }
}

function startSidecar(): void {
  if (sidecar || startingUp) return
  startingUp = true
  ready = false
  stdoutBuffer = ''
  sidecar = spawnSidecar()
}

function drainQueue(): void {
  if (processing || !ready || commandQueue.length === 0) return

  const next = commandQueue.shift()!
  processCommand(next.command, next.timeout).then(next.resolve, next.reject)
}

function processCommand(
  command: ScrapingCommand,
  timeout: number,
): Promise<ScrapingResponse> {
  return new Promise((resolve, reject) => {
    if (!sidecar || !sidecar.stdin?.writable) {
      reject(new Error('Sidecar not available'))
      return
    }

    processing = true

    const timer = setTimeout(() => {
      if (currentRequest) {
        currentRequest = null
        processing = false
        reject(new Error(`Command timed out after ${timeout}ms`))
        drainQueue()
      }
    }, timeout)

    currentRequest = { resolve, reject, timer }

    const payload = JSON.stringify(command) + '\n'
    sidecar.stdin.write(payload)
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the Python sidecar and verify it responds to a health check.
 * Safe to call multiple times -- only spawns once.
 */
export async function initScrapingSidecar(): Promise<HealthCheckResponse> {
  if (ready && sidecar) {
    const resp = await sendScrapingCommand({ cmd: 'health_check' })
    return resp as HealthCheckResponse
  }

  startSidecar()

  // Wait for the ready signal (up to 15s)
  await new Promise<void>((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (ready) return resolve()
      if (Date.now() - start > 15_000) return reject(new Error('Sidecar startup timeout'))
      setTimeout(check, 200)
    }
    check()
  })

  const resp = await sendScrapingCommand({ cmd: 'health_check' })
  if ('error' in resp) {
    throw new Error(`Health check failed: ${(resp as ErrorResponse).error}`)
  }
  return resp as HealthCheckResponse
}

/**
 * Send a command to the sidecar. Queues if another command is in flight.
 */
export function sendScrapingCommand(
  command: ScrapingCommand,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<ScrapingResponse> {
  // Auto-start if not running
  if (!sidecar && !startingUp) {
    startSidecar()
  }

  if (!ready) {
    return new Promise((resolve, reject) => {
      commandQueue.push({ command, resolve, reject, timeout })
    })
  }

  if (processing) {
    return new Promise((resolve, reject) => {
      commandQueue.push({ command, resolve, reject, timeout })
    })
  }

  return processCommand(command, timeout)
}

/**
 * Gracefully shut down the sidecar process.
 */
export function shutdownSidecar(): void {
  if (!sidecar) return

  console.log('[scrapling-bridge] shutting down sidecar')

  // Reject any pending work
  if (currentRequest) {
    clearTimeout(currentRequest.timer)
    currentRequest.reject(new Error('Sidecar shutting down'))
    currentRequest = null
    processing = false
  }

  for (const queued of commandQueue.splice(0)) {
    queued.reject(new Error('Sidecar shutting down'))
  }

  try {
    sidecar.stdin?.end()
    sidecar.kill()
  } catch {}

  sidecar = null
  ready = false
  startingUp = false
}
