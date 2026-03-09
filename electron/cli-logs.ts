import fs from 'fs'
import path from 'path'
import readline from 'readline'
import os from 'os'

interface CLISession {
  sessionId: string
  firstPrompt: string
  messageCount: number
  created: string
  modified: string
  project: string
}

interface CLISessionMessage {
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  model?: string
  uuid?: string
}

function getClaudeProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

export async function getCliSessions(): Promise<CLISession[]> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const sessions: CLISession[] = []

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)

      // Check for sessions-index.json first (pre-computed metadata)
      const indexPath = path.join(projPath, 'sessions-index.json')
      if (fs.existsSync(indexPath)) {
        try {
          const indexRaw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
          const entries = Array.isArray(indexRaw) ? indexRaw : indexRaw.entries
          if (Array.isArray(entries)) {
            for (const entry of entries) {
              sessions.push({
                sessionId: entry.sessionId || entry.id || '',
                firstPrompt: entry.summary || entry.firstPrompt || '',
                messageCount: entry.messageCount || 0,
                created: entry.created || entry.createdAt || '',
                modified: entry.modified || entry.updatedAt || '',
                project: projDir.name
              })
            }
            continue
          }
        } catch {}
      }

      // Fall back to scanning JSONL files
      const jsonlFiles = fs.readdirSync(projPath)
        .filter(f => f.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projPath, file)
        const sessionId = file.replace('.jsonl', '')
        try {
          const stat = fs.statSync(filePath)
          // Quick scan: read first few lines for first prompt
          const firstPrompt = await getFirstPrompt(filePath)
          const lineCount = await countLines(filePath)

          sessions.push({
            sessionId,
            firstPrompt,
            messageCount: lineCount,
            created: stat.birthtime.toISOString(),
            modified: stat.mtime.toISOString(),
            project: projDir.name
          })
        } catch {}
      }
    }
  } catch {}

  return sessions.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
}

async function getFirstPrompt(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    let found = false

    rl.on('line', (line) => {
      if (found) return
      try {
        const parsed = JSON.parse(line)
        if (parsed.type === 'user' && !parsed.isMeta) {
          const content = extractTextContent(parsed)
          if (content) {
            found = true
            resolve(content.slice(0, 100))
            rl.close()
            stream.destroy()
          }
        }
      } catch {}
    })

    rl.on('close', () => {
      if (!found) resolve('')
    })

    rl.on('error', () => resolve(''))
  })
}

async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    let count = 0
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', () => { count++ })
    rl.on('close', () => resolve(count))
    rl.on('error', () => resolve(0))
  })
}

function isDisplayableMessage(parsed: any): boolean {
  // Skip non-message types
  if (['file-history-snapshot', 'summary', 'progress', 'system'].includes(parsed.type)) return false
  // Skip meta messages
  if (parsed.isMeta) return false
  // Only user and assistant
  return parsed.type === 'user' || parsed.type === 'assistant'
}

function extractTextContent(parsed: any): string {
  // Claude Code JSONL format: message.content can be string or array of content blocks
  if (typeof parsed.message?.content === 'string') {
    return parsed.message.content
  }
  if (Array.isArray(parsed.message?.content)) {
    // Filter out thinking blocks, tool_use blocks, file-history-snapshot — keep only text
    return parsed.message.content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  // Alternative format (some entries use top-level content)
  if (typeof parsed.content === 'string') {
    return parsed.content
  }
  if (Array.isArray(parsed.content)) {
    return parsed.content
      .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
  }
  return ''
}

export async function getCliSessionMessages(
  sessionId: string,
  offset: number = 0,
  limit: number = 50
): Promise<{ messages: CLISessionMessage[]; hasMore: boolean }> {
  const filePath = await findSessionFile(sessionId)
  if (!filePath) return { messages: [], hasMore: false }

  return new Promise((resolve) => {
    const messages: CLISessionMessage[] = []
    let lineIndex = 0
    let collected = 0

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)

        if (!isDisplayableMessage(parsed)) return

        const type: 'user' | 'assistant' = parsed.type === 'user' ? 'user' : 'assistant'
        const content = extractTextContent(parsed)
        if (!content) return

        if (lineIndex >= offset && collected < limit) {
          messages.push({
            type,
            content: content.slice(0, 5000),
            timestamp: parsed.timestamp || '',
            model: parsed.message?.model || undefined,
            uuid: parsed.uuid || undefined
          })
          collected++
        }

        lineIndex++
      } catch {}
    })

    rl.on('close', () => {
      resolve({
        messages,
        hasMore: lineIndex > offset + limit
      })
    })

    rl.on('error', () => {
      resolve({ messages: [], hasMore: false })
    })
  })
}

async function findSessionFile(sessionId: string): Promise<string | null> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return null

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const filePath = path.join(projectsDir, projDir.name, `${sessionId}.jsonl`)
      if (fs.existsSync(filePath)) return filePath
    }
  } catch {}

  return null
}

export async function searchCliSessions(
  query: string
): Promise<{ sessionId: string; firstPrompt: string; matches: string[]; project: string }[]> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const results: { sessionId: string; firstPrompt: string; matches: string[]; project: string }[] = []
  const lowerQuery = query.toLowerCase()

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)
      const jsonlFiles = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projPath, file)
        const sessionId = file.replace('.jsonl', '')

        const sessionResult = await searchInSession(filePath, sessionId, lowerQuery, projDir.name)
        if (sessionResult) {
          results.push(sessionResult)
        }

        if (results.length >= 20) break
      }
      if (results.length >= 20) break
    }
  } catch {}

  return results
}

export async function findSessionByPromptFragment(
  fragment: string,
  afterTimestamp?: string
): Promise<string | null> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return null
  const lowerFragment = fragment.toLowerCase()

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name)
      const jsonlFiles = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'))

      for (const file of jsonlFiles) {
        const filePath = path.join(projPath, file)
        const sessionId = file.replace('.jsonl', '')

        // Filter by creation time if afterTimestamp provided
        if (afterTimestamp) {
          try {
            const stat = fs.statSync(filePath)
            if (stat.birthtime.toISOString() < afterTimestamp) continue
          } catch { continue }
        }

        const firstPrompt = await getFirstPrompt(filePath)
        if (firstPrompt.toLowerCase().includes(lowerFragment)) {
          return sessionId
        }
      }
    }
  } catch {}

  return null
}

// --- Session utilities for agent auto-completion ---

export interface SessionResult {
  summary: string
  totalInputTokens: number
  totalOutputTokens: number
  model: string
  toolCalls?: { tool: string; count: number }[]
  filesChanged?: string[]
  gitCommits?: string[]
}

/** Find the JSONL file path for a given session ID */
export function getSessionFilePath(sessionId: string): string | null {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return null

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())

    for (const projDir of projectDirs) {
      const filePath = path.join(projectsDir, projDir.name, `${sessionId}.jsonl`)
      if (fs.existsSync(filePath)) return filePath
    }
  } catch {}

  return null
}

/** Check if a session file is complete (no writes in the last 90 seconds) */
export function isSessionComplete(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath)
    return Date.now() - stat.mtimeMs > 90_000
  } catch {
    return false
  }
}

/** Extract token usage, summary, tool calls, files changed, and git commits from a completed session JSONL */
export async function extractSessionResult(filePath: string): Promise<SessionResult> {
  return new Promise((resolve) => {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let model = ''
    let lastTextContent = ''
    const toolCounts = new Map<string, number>()
    const filesChanged = new Set<string>()
    const gitCommits: string[] = []

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)

        // Track file-history-snapshot entries for files changed
        if (parsed.type === 'file-history-snapshot' && parsed.filePath) {
          filesChanged.add(parsed.filePath)
        }

        if (parsed.type === 'assistant') {
          if (parsed.message?.usage) {
            totalInputTokens += parsed.message.usage.input_tokens || 0
            totalOutputTokens += parsed.message.usage.output_tokens || 0
          }
          if (parsed.message?.model) {
            model = parsed.message.model
          }
          const text = extractTextContent(parsed)
          if (text) lastTextContent = text

          // Parse tool_use blocks for tool counts and file/commit tracking
          if (Array.isArray(parsed.message?.content)) {
            for (const block of parsed.message.content) {
              if (block.type === 'tool_use' && block.name) {
                toolCounts.set(block.name, (toolCounts.get(block.name) || 0) + 1)
                // Track file paths from Write/Edit tool inputs
                if ((block.name === 'Write' || block.name === 'Edit') && block.input?.file_path) {
                  filesChanged.add(block.input.file_path)
                }
                // Detect git commit messages from Bash tool inputs
                if (block.name === 'Bash' && typeof block.input?.command === 'string') {
                  const commitMatch = block.input.command.match(/git commit\s+-m\s+["']([^"']+)["']/)
                  if (commitMatch) gitCommits.push(commitMatch[1])
                }
              }
            }
          }
        }
      } catch {}
    })

    rl.on('close', () => {
      const toolCallsArr = Array.from(toolCounts.entries()).map(([tool, count]) => ({ tool, count }))
      resolve({
        summary: lastTextContent.slice(0, 2000),
        totalInputTokens,
        totalOutputTokens,
        model,
        toolCalls: toolCallsArr.length > 0 ? toolCallsArr : undefined,
        filesChanged: filesChanged.size > 0 ? Array.from(filesChanged) : undefined,
        gitCommits: gitCommits.length > 0 ? gitCommits : undefined,
      })
    })

    rl.on('error', () => {
      resolve({ summary: '', totalInputTokens: 0, totalOutputTokens: 0, model: '' })
    })
  })
}

async function searchInSession(
  filePath: string,
  sessionId: string,
  lowerQuery: string,
  project: string = ''
): Promise<{ sessionId: string; firstPrompt: string; matches: string[]; project: string } | null> {
  return new Promise((resolve) => {
    const matches: string[] = []
    let firstPrompt = ''

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)
        if (!isDisplayableMessage(parsed)) return

        const content = extractTextContent(parsed)
        if (!content) return

        if (!firstPrompt && parsed.type === 'user') {
          firstPrompt = content.slice(0, 100)
        }

        if (content.toLowerCase().includes(lowerQuery)) {
          // Extract a snippet around the match
          const idx = content.toLowerCase().indexOf(lowerQuery)
          const start = Math.max(0, idx - 40)
          const end = Math.min(content.length, idx + lowerQuery.length + 40)
          matches.push(content.slice(start, end))
        }
      } catch {}
    })

    rl.on('close', () => {
      if (matches.length > 0) {
        resolve({ sessionId, firstPrompt, matches: matches.slice(0, 5), project })
      } else {
        resolve(null)
      }
    })

    rl.on('error', () => resolve(null))
  })
}
