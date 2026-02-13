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
): Promise<{ sessionId: string; firstPrompt: string; matches: string[] }[]> {
  const projectsDir = getClaudeProjectsDir()
  if (!fs.existsSync(projectsDir)) return []

  const results: { sessionId: string; firstPrompt: string; matches: string[] }[] = []
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

        const sessionResult = await searchInSession(filePath, sessionId, lowerQuery)
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

async function searchInSession(
  filePath: string,
  sessionId: string,
  lowerQuery: string
): Promise<{ sessionId: string; firstPrompt: string; matches: string[] } | null> {
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
        resolve({ sessionId, firstPrompt, matches: matches.slice(0, 5) })
      } else {
        resolve(null)
      }
    })

    rl.on('error', () => resolve(null))
  })
}
