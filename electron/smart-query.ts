import { BrowserWindow } from 'electron'
import { getChatSettings, getBriefingData, getRoadmapGoals, getMasterPlanTasks, getRecentNotes, getMasterPlan } from './database'
import { getRelevantMemories } from './memory'
import { search } from './vector-store'
import { streamLLM } from './llm'

export async function streamSmartQuery(
  mainWindow: BrowserWindow,
  queryId: string,
  query: string
): Promise<void> {
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
  let endSent = false

  streamLLM(
    {
      messages: [{ role: 'user', content: query }],
      system: systemPrompt,
      model: settings.model,
      maxTokens: settings.maxTokens,
      tier: 'chat',
    },
    {
      onData: (text) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('smart-query-chunk', { queryId, text })
        }
      },
      onEnd: () => {
        if (!endSent && !mainWindow.isDestroyed()) {
          endSent = true
          mainWindow.webContents.send('smart-query-end', { queryId })
        }
      },
      onError: (error) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('smart-query-error', { queryId, error })
        }
      },
    }
  )
}
