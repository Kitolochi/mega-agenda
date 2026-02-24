import https from 'https'
import { BrowserWindow } from 'electron'
import { getClaudeApiKey, getChatSettings, getBriefingData, getRoadmapGoals, getMasterPlanTasks, getRecentNotes, getMasterPlan } from './database'
import { getRelevantMemories } from './memory'
import { search } from './vector-store'

export async function streamSmartQuery(
  mainWindow: BrowserWindow,
  queryId: string,
  query: string
): Promise<void> {
  const apiKey = getClaudeApiKey()
  if (!apiKey) {
    mainWindow.webContents.send('smart-query-error', { queryId, error: 'No Claude API key configured.' })
    return
  }

  // 1. RAG search over ~/.claude/memory/
  let ragContext = ''
  try {
    const ragResults = await search(query, { topK: 15 })
    if (ragResults && ragResults.length > 0) {
      ragContext = ragResults.map(r => `[${r.domain}/${r.heading}] ${r.text.slice(0, 300)}`).join('\n')
    }
  } catch {}

  // 2. Relevant memories
  const memories = getRelevantMemories(query, [], 15, 2000)
  const memoryContext = memories.map(m => `- [${m.topics.join(', ')}] ${m.title}: ${m.content}`).join('\n')

  // 3. Goals with task progress
  const goals = getRoadmapGoals()
  const goalsContext = goals.map(g => {
    const tasks = getMasterPlanTasks(`goal-${g.id}`)
    const completed = tasks.filter(t => t.status === 'completed').length
    const total = tasks.length
    const progress = total > 0 ? ` (${completed}/${total} tasks done)` : ''
    return `- [${g.category}/${g.priority}] ${g.title}${progress} — ${g.status}`
  }).join('\n')

  // 4. Activity data
  const briefing = getBriefingData()
  const activityContext = [
    `Current streak: ${briefing.streak} days`,
    `Tasks completed this week: ${briefing.stats.tasksCompletedThisWeek}`,
    briefing.overdueTasks.length > 0 ? `Overdue: ${briefing.overdueTasks.map((t: any) => t.title).join(', ')}` : null,
    briefing.todayTasks.length > 0 ? `Due today: ${briefing.todayTasks.map((t: any) => t.title).join(', ')}` : null,
    briefing.highPriorityTasks.length > 0 ? `High priority: ${briefing.highPriorityTasks.map((t: any) => t.title).join(', ')}` : null,
  ].filter(Boolean).join('\n')

  // 5. Recent journal
  const recentNotes = getRecentNotes(5)
  const journalContext = recentNotes.map(n => `${n.date}: ${n.content.slice(0, 200)}`).join('\n')

  // 6. Master plan
  const masterPlan = getMasterPlan()
  const planContext = masterPlan ? masterPlan.content.slice(0, 2000) : '(No master plan generated yet)'

  const today = new Date().toISOString().split('T')[0]
  const systemPrompt = `You are the Smart Query system for Mega Agenda, a personal life management app. Today is ${today}.

You have comprehensive access to the user's life data. Answer their question using ALL relevant context below. Be specific — cite actual goals, tasks, memories, and journal entries by name. Be concise but thorough.

## User's Goals
${goalsContext || '(No goals set)'}

## Activity & Productivity
${activityContext}

## Recent Journal Entries
${journalContext || '(No recent journal entries)'}

## Master Plan
${planContext}

## Relevant Memories
${memoryContext || '(No relevant memories found)'}

## RAG Context (from knowledge base)
${ragContext || '(No relevant documents found)'}

Guidelines:
- Reference specific goals, tasks, and data points
- If asked about priorities, consider urgency (overdue/today), importance (critical/high), and goal progress
- If asked about progress, calculate completion percentages and highlight both achievements and gaps
- If asked about patterns, draw from journal entries and memories
- Be actionable — suggest specific next steps when appropriate`

  const settings = getChatSettings()
  const body = JSON.stringify({
    model: settings.model,
    max_tokens: settings.maxTokens,
    stream: true,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }]
  })

  let endSent = false

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
          mainWindow.webContents.send('smart-query-error', { queryId, error: errorMsg })
        }
      })
      return
    }

    let buffer = ''

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
                mainWindow.webContents.send('smart-query-chunk', { queryId, text: event.delta.text })
              }
            } else if (event.type === 'message_stop') {
              if (!endSent && !mainWindow.isDestroyed()) {
                endSent = true
                mainWindow.webContents.send('smart-query-end', { queryId })
              }
            } else if (event.type === 'error') {
              if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('smart-query-error', { queryId, error: event.error?.message || 'Stream error' })
              }
            }
          } catch {}
        }
      }
    })

    res.on('end', () => {
      if (!endSent && !mainWindow.isDestroyed()) {
        endSent = true
        mainWindow.webContents.send('smart-query-end', { queryId })
      }
    })
  })

  req.on('error', (err) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('smart-query-error', { queryId, error: err.message || 'Network error' })
    }
  })

  req.setTimeout(120000, () => {
    req.destroy()
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('smart-query-error', { queryId, error: 'Request timeout' })
    }
  })

  req.write(body)
  req.end()
}
