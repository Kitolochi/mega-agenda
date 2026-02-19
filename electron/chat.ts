import https from 'https'
import { BrowserWindow } from 'electron'
import { getBriefingData, getClaudeApiKey, getChatSettings } from './database'
import { getRelevantMemories } from './memory'

let activeRequest: ReturnType<typeof https.request> | null = null

export function buildContextSystemPrompt(messages?: { role: string; content: string }[]): string {
  const data = getBriefingData()
  const today = new Date().toISOString().split('T')[0]
  const parts: string[] = [
    'You are a helpful assistant embedded in Mega Agenda, a personal productivity app.',
    `Today is ${today}.`,
  ]

  if (data.overdueTasks.length > 0) {
    parts.push(`Overdue tasks: ${data.overdueTasks.map(t => t.title).join(', ')}`)
  }
  if (data.todayTasks.length > 0) {
    parts.push(`Tasks due today: ${data.todayTasks.map(t => t.title).join(', ')}`)
  }
  if (data.highPriorityTasks.length > 0) {
    parts.push(`High priority tasks: ${data.highPriorityTasks.map(t => t.title).join(', ')}`)
  }
  if (data.streak > 0) {
    parts.push(`User's current streak: ${data.streak} days`)
  }
  parts.push(`Tasks completed this week: ${data.stats.tasksCompletedThisWeek}`)

  if (data.recentNotes.length > 0) {
    parts.push(`Recent journal notes: ${data.recentNotes.map(n => `${n.date}: ${n.content.slice(0, 100)}`).join('; ')}`)
  }

  // Inject relevant memories
  if (messages && messages.length > 0) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''
    const relevant = getRelevantMemories(lastUserMessage, messages)
    if (relevant.length > 0) {
      parts.push('')
      parts.push('Relevant context from your memory bank:')
      relevant.forEach(mem => {
        parts.push(`- [${mem.topics.join(', ')}] ${mem.title}: ${mem.content}`)
      })
    }
  }

  return parts.join('\n')
}

export function streamChatMessage(
  mainWindow: BrowserWindow,
  conversationId: string,
  messages: { role: string; content: string }[],
  systemPrompt?: string
): void {
  const apiKey = getClaudeApiKey()
  if (!apiKey) {
    mainWindow.webContents.send('chat-stream-error', {
      conversationId,
      error: 'No Claude API key configured. Add one in Settings.'
    })
    return
  }

  const settings = getChatSettings()
  const resolvedSystemPrompt = systemPrompt ||
    (settings.systemPromptMode === 'context' ? buildContextSystemPrompt(messages) :
     settings.systemPromptMode === 'custom' ? (settings.customSystemPrompt || '') :
     'You are a helpful assistant.')

  const body = JSON.stringify({
    model: settings.model,
    max_tokens: settings.maxTokens,
    stream: true,
    system: resolvedSystemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  })

  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    }
  }, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      let errorData = ''
      res.on('data', (chunk: Buffer) => { errorData += chunk.toString() })
      res.on('end', () => {
        let errorMsg = `API error ${res.statusCode}`
        try {
          const parsed = JSON.parse(errorData)
          errorMsg = parsed.error?.message || errorMsg
        } catch {}
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat-stream-error', { conversationId, error: errorMsg })
        }
      })
      return
    }

    let buffer = ''
    let usage = { input: 0, output: 0 }
    let model = settings.model

    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue
          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'content_block_delta' && event.delta?.text) {
              if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('chat-stream-chunk', {
                  conversationId,
                  text: event.delta.text
                })
              }
            } else if (event.type === 'message_start' && event.message) {
              model = event.message.model || model
              if (event.message.usage) {
                usage.input = event.message.usage.input_tokens || 0
              }
            } else if (event.type === 'message_delta' && event.usage) {
              usage.output = event.usage.output_tokens || 0
            } else if (event.type === 'message_stop') {
              if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('chat-stream-end', {
                  conversationId,
                  model,
                  usage
                })
              }
            } else if (event.type === 'error') {
              if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('chat-stream-error', {
                  conversationId,
                  error: event.error?.message || 'Stream error'
                })
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    })

    res.on('end', () => {
      activeRequest = null
    })
  })

  req.on('error', (err) => {
    activeRequest = null
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat-stream-error', {
        conversationId,
        error: err.message || 'Network error'
      })
    }
  })

  req.setTimeout(120000, () => {
    req.destroy()
    activeRequest = null
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat-stream-error', {
        conversationId,
        error: 'Request timeout (2 minutes)'
      })
    }
  })

  activeRequest = req
  req.write(body)
  req.end()
}

export function getMemoryCountForChat(messages: { role: string; content: string }[]): number {
  if (messages.length === 0) return 0
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  return getRelevantMemories(lastUserMessage, messages).length
}

export function abortChatStream(): void {
  if (activeRequest) {
    activeRequest.destroy()
    activeRequest = null
  }
}
