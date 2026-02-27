import { callLLM } from './llm'
import { verifyLLMKey } from './llm'

interface ArticleInput {
  title: string
  description: string
}

export async function summarizeAI(_apiKey: string, articles: ArticleInput[]): Promise<string> {
  const list = articles.slice(0, 40).map((a, i) =>
    `${i + 1}. ${a.title}${a.description ? ` — ${a.description.slice(0, 150)}` : ''}`
  ).join('\n')

  const prompt = `Here are the latest articles from AI and tech feeds:\n\n${list}\n\nSummarize the most important developments, organized into these groups:\n- **Model releases & company news** (Anthropic/Claude, OpenAI/GPT, Google/Gemini, video/image models)\n- **Practical tips & experiences** (people sharing how they use AI, best practices, workflows)\n- **Research & breakthroughs** (notable papers, benchmarks, technical advances)\n\nUse bullet points under each group. Skip any group if there's nothing relevant. Be concise — max 3-4 bullets per group. If an article isn't AI-related, skip it.`

  return callLLM({ prompt, tier: 'fast', maxTokens: 1024 })
}

export async function summarizeGeo(_apiKey: string, articles: ArticleInput[]): Promise<string> {
  const list = articles.slice(0, 40).map((a, i) =>
    `${i + 1}. ${a.title}${a.description ? ` — ${a.description.slice(0, 150)}` : ''}`
  ).join('\n')

  const prompt = `Here are the latest articles from world news feeds:\n\n${list}\n\nSummarize the most important geopolitical developments and world events. Use bullet points. Focus on what's most significant and actionable to know. Max 6-8 bullets. Be concise.`

  return callLLM({ prompt, tier: 'fast', maxTokens: 1024 })
}

export async function parseVoiceCommand(_apiKey: string, transcript: string, categoryNames: string[]): Promise<any> {
  const prompt = `You are a voice command parser for a task management app. Parse the user's spoken command into a structured JSON response.

The app has these categories: ${categoryNames.join(', ')}
The app has these tabs: dashboard, tasks, notes (journal), feed

Parse the following voice command and return ONLY valid JSON (no markdown, no explanation):
"${transcript}"

Return JSON with these fields:
{
  "action": one of "add_task", "complete_task", "switch_tab", "open_modal", "add_note", "summarize_feed", "unknown",
  "category": category name if mentioned (match to closest category from the list above),
  "title": task title if adding/completing a task,
  "priority": 1-3 (1=low, 2=medium, 3=high) if mentioned, default 2,
  "description": task description if provided,
  "tab": tab name if switching ("dashboard", "tasks", "notes", "feed"),
  "note": journal note content if adding a note
}

Examples:
- "add task to work finish the report high priority" → {"action":"add_task","category":"Work","title":"finish the report","priority":3}
- "go to feed" → {"action":"switch_tab","tab":"feed"}
- "mark done buy groceries" → {"action":"complete_task","title":"buy groceries"}
- "new task" → {"action":"open_modal"}
- "note met with Sarah about the project" → {"action":"add_note","note":"met with Sarah about the project"}
- "summarize AI news" → {"action":"summarize_feed"}
- "show dashboard" → {"action":"switch_tab","tab":"dashboard"}`

  const response = await callLLM({ prompt, tier: 'fast', maxTokens: 1024 })
  try {
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { action: 'unknown' }
  }
}

export async function generateMorningBriefing(_apiKey: string, data: {
  overdueTasks: { title: string; priority: number }[]
  todayTasks: { title: string; priority: number }[]
  highPriorityTasks: { title: string; priority: number }[]
  stats: { currentStreak: number; tasksCompletedThisWeek: number }
  recentNotes: { date: string; content: string }[]
  streak: number
}): Promise<string> {
  const context = [
    data.overdueTasks.length > 0 ? `Overdue tasks: ${data.overdueTasks.map(t => t.title).join(', ')}` : '',
    data.todayTasks.length > 0 ? `Due today: ${data.todayTasks.map(t => t.title).join(', ')}` : '',
    data.highPriorityTasks.length > 0 ? `High priority: ${data.highPriorityTasks.map(t => t.title).join(', ')}` : '',
    `Current streak: ${data.streak} days`,
    `Tasks completed this week: ${data.stats.tasksCompletedThisWeek}`,
    data.recentNotes.length > 0 ? `Recent journal entries: ${data.recentNotes.map(n => `${n.date}: ${n.content.slice(0, 100)}`).join('; ')}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `You are a productivity assistant generating a morning briefing. Based on this user's task data, write 4-6 concise bullet points to help them start their day effectively.

${context}

Rules:
- Start with the most urgent items (overdue, high priority)
- Be encouraging but honest about workload
- Reference their streak if active
- Keep each bullet to 1 sentence
- Use plain text bullet points starting with "- "
- No headers, no markdown formatting beyond bullets
- Be direct and actionable`

  return callLLM({ prompt, tier: 'fast', maxTokens: 1024 })
}

export async function generateWeeklyReview(_apiKey: string, data: {
  completedTasks: { title: string; category: string; priority: number }[]
  focusMinutes: number
  notesCount: number
  categoriesWorked: string[]
  streak: number
}): Promise<string> {
  const context = [
    `Tasks completed: ${data.completedTasks.length}`,
    data.completedTasks.length > 0 ? `Completed: ${data.completedTasks.map(t => `${t.title} (${t.category})`).join(', ')}` : '',
    `Focus time: ${data.focusMinutes} minutes`,
    `Journal entries: ${data.notesCount}`,
    data.categoriesWorked.length > 0 ? `Categories worked: ${data.categoriesWorked.join(', ')}` : '',
    `Current streak: ${data.streak} days`,
  ].filter(Boolean).join('\n')

  const prompt = `You are a productivity coach writing a brief weekly review. Based on this user's week data, write a 100-200 word review.

${context}

Structure your response with these sections using **bold** headers:
**Week Summary** - 2-3 sentences overview
**Highlights** - top 2-3 achievements as bullet points
**Focus Areas** - 1-2 suggestions for next week

Be encouraging, specific, and concise. Use markdown bullet points for lists.`

  return callLLM({ prompt, tier: 'fast', maxTokens: 1024 })
}

export async function verifyClaudeKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  return verifyLLMKey('claude', apiKey)
}
