import { BrowserWindow } from 'electron'
import { getBriefingData, getChatSettings } from './database'
import { getRelevantMemories } from './memory'
import { streamLLM } from './llm'
import { getCompressedOverview } from './compressor'

let activeAbort: (() => void) | null = null

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

  // Inject compressed knowledge overview
  const compressedOverview = getCompressedOverview()
  if (compressedOverview) {
    parts.push('')
    parts.push('Knowledge base overview:')
    parts.push(compressedOverview)
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
  const settings = getChatSettings()
  const resolvedSystemPrompt = systemPrompt ||
    (settings.systemPromptMode === 'context' ? buildContextSystemPrompt(messages) :
     settings.systemPromptMode === 'custom' ? (settings.customSystemPrompt || '') :
     'You are a helpful assistant.')

  const { abort } = streamLLM(
    {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      system: resolvedSystemPrompt,
      model: settings.model,
      maxTokens: settings.maxTokens,
      tier: 'chat',
    },
    {
      onData: (text) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat-stream-chunk', { conversationId, text })
        }
      },
      onEnd: (info) => {
        activeAbort = null
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat-stream-end', {
            conversationId,
            model: info.model,
            usage: info.usage
          })
        }
      },
      onError: (error) => {
        activeAbort = null
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat-stream-error', { conversationId, error })
        }
      },
    }
  )

  activeAbort = abort
}

export function getMemoryCountForChat(messages: { role: string; content: string }[]): number {
  if (messages.length === 0) return 0
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''
  return getRelevantMemories(lastUserMessage, messages).length
}

export function abortChatStream(): void {
  if (activeAbort) {
    activeAbort()
    activeAbort = null
  }
}
