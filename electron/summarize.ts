import https from 'https'

interface ArticleInput {
  title: string
  description: string
}

function callClaude(apiKey: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
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
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            resolve(parsed.content?.[0]?.text || 'No summary generated')
          }
        } catch {
          reject(new Error('Failed to parse API response'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

export async function summarizeAI(apiKey: string, articles: ArticleInput[]): Promise<string> {
  const list = articles.slice(0, 40).map((a, i) =>
    `${i + 1}. ${a.title}${a.description ? ` — ${a.description.slice(0, 150)}` : ''}`
  ).join('\n')

  const prompt = `Here are the latest articles from AI and tech feeds:\n\n${list}\n\nSummarize the most important developments, organized into these groups:\n- **Model releases & company news** (Anthropic/Claude, OpenAI/GPT, Google/Gemini, video/image models)\n- **Practical tips & experiences** (people sharing how they use AI, best practices, workflows)\n- **Research & breakthroughs** (notable papers, benchmarks, technical advances)\n\nUse bullet points under each group. Skip any group if there's nothing relevant. Be concise — max 3-4 bullets per group. If an article isn't AI-related, skip it.`

  return callClaude(apiKey, prompt)
}

export async function summarizeGeo(apiKey: string, articles: ArticleInput[]): Promise<string> {
  const list = articles.slice(0, 40).map((a, i) =>
    `${i + 1}. ${a.title}${a.description ? ` — ${a.description.slice(0, 150)}` : ''}`
  ).join('\n')

  const prompt = `Here are the latest articles from world news feeds:\n\n${list}\n\nSummarize the most important geopolitical developments and world events. Use bullet points. Focus on what's most significant and actionable to know. Max 6-8 bullets. Be concise.`

  return callClaude(apiKey, prompt)
}

export async function parseVoiceCommand(apiKey: string, transcript: string, categoryNames: string[]): Promise<any> {
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

  const response = await callClaude(apiKey, prompt)
  try {
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { action: 'unknown' }
  }
}

export async function verifyClaudeKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    await callClaude(apiKey, 'Say "ok" and nothing else.')
    return { valid: true }
  } catch (err: any) {
    return { valid: false, error: err.message || 'Invalid API key' }
  }
}
