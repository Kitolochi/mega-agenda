import https from 'https'
import fs from 'fs'
import path from 'path'
import { execSync, spawn as spawnProcess } from 'child_process'

interface RoadmapGoal {
  id: string
  title: string
  description: string
  category: string
  research_questions: string[]
  guidance_needed: string[]
  topicReports?: { topic: string; type: string; report: string; generatedAt: string }[]
  personalContext?: string
  contextFiles?: string[]
}

// --- Claude CLI Detection (cached) ---

let _cliPath: string | null | undefined = undefined

export function findClaudeCli(): string | null {
  if (_cliPath !== undefined) return _cliPath
  try {
    execSync('claude --version', { stdio: 'pipe', timeout: 10000, shell: true })
    _cliPath = 'claude'
  } catch {
    const npmGlobal = path.join(process.env.APPDATA || '', 'npm', 'claude.cmd')
    _cliPath = fs.existsSync(npmGlobal) ? npmGlobal : null
  }
  return _cliPath
}

// --- Environment helper ---

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.CLAUDECODE
  return env
}

// --- Rate limit retry helper ---

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelayMs: number = 15000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isRateLimit = err?.message?.includes('rate limit') || err?.message?.includes('rate_limit')
      if (!isRateLimit || attempt === maxRetries) throw err
      const delay = baseDelayMs * (attempt + 1)
      console.log(`  Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Retry exhausted')
}

// --- API Helpers ---

function callClaude(apiKey: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          else resolve(parsed.content?.[0]?.text || '')
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

function callClaudeWithWebSearch(apiKey: string, prompt: string, maxSearches: number = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }],
      messages: [{ role: 'user', content: prompt }]
    })
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            const textParts = (parsed.content || [])
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
            resolve(textParts.join('\n\n') || 'No analysis generated')
          }
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(300000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

// --- Research Prompts ---

function buildResearchPrompt(goalTitle: string, goalDescription: string, topic: string, topicType: 'question' | 'guidance'): string {
  return `You are a research analyst helping someone achieve a life goal. Use web search to find current, accurate information on the specific topic below.

## Parent Goal: ${goalTitle}
${goalDescription ? `Description: ${goalDescription}` : ''}

## Topic to Research (${topicType === 'question' ? 'Research Question' : 'Guidance Need'}):
${topic}

---

Search the web thoroughly for this topic. Find multiple authoritative sources. Then provide a focused research report:

1. **Summary** — 2-3 sentence overview of findings
2. **Key Findings** — Detailed answer with evidence from web search results
3. **Practical Recommendations** — Actionable advice
4. **Key Resources** — Most useful links found
5. **Next Steps** — Concrete action items

Be specific, cite sources where possible, and focus on actionable insights.`
}

// --- CLI-Based Research ---

function researchTopicWithCli(
  cliPath: string,
  goalTitle: string,
  goalDescription: string,
  topic: string,
  topicType: 'question' | 'guidance'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpDir = process.env.TEMP || process.env.TMP || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Temp') : '/tmp')
    const tmpFile = path.join(tmpDir, `mega-research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`)

    const instructions = buildResearchPrompt(goalTitle, goalDescription, topic, topicType)
    fs.writeFileSync(tmpFile, instructions, 'utf-8')

    const cliPrompt = `Read the research instructions at "${tmpFile}" and execute them. Use web search to research the topic thoroughly. Return only the research report directly as text. Do NOT create or write any files.`

    const proc = spawnProcess(cliPath, ['-p', cliPrompt, '--max-turns', '15'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv(),
    })

    let output = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      try { fs.unlinkSync(tmpFile) } catch {}
      reject(new Error('CLI research timed out after 5 minutes'))
    }, 300000)

    proc.stdout?.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      try { fs.unlinkSync(tmpFile) } catch {}
      if (code === 0 && output.trim().length > 50) {
        resolve(output.trim())
      } else {
        reject(new Error(`CLI exited ${code}: ${stderr.slice(0, 300) || 'no output'}`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      try { fs.unlinkSync(tmpFile) } catch {}
      reject(err)
    })
  })
}

// --- Smart Research (CLI first, API fallback) ---

export async function researchTopicSmart(
  goal: RoadmapGoal,
  topic: string,
  topicType: 'question' | 'guidance',
  claudeApiKey: string
): Promise<string> {
  const cliPath = findClaudeCli()

  if (cliPath) {
    try {
      return await researchTopicWithCli(cliPath, goal.title, goal.description, topic, topicType)
    } catch (err) {
      console.log(`CLI research failed for "${topic.slice(0, 50)}...", falling back to API: ${(err as Error).message}`)
    }
  }

  // Fallback: API with web search (with rate limit retry)
  const prompt = buildResearchPrompt(goal.title, goal.description, topic, topicType)
  return withRetry(() => callClaudeWithWebSearch(claudeApiKey, prompt, 10))
}

// --- Topic Generation ---

export async function generateTopics(
  goal: RoadmapGoal,
  claudeApiKey: string
): Promise<{ research_questions: string[]; guidance_needed: string[] }> {
  const prompt = `You are helping someone break down a life/project goal into specific research topics. Given the goal below, generate comprehensive research questions and guidance needs.

## Goal: ${goal.title}
${goal.description ? `Description: ${goal.description}` : ''}
Category: ${goal.category}

Generate two JSON arrays:
1. "research_questions" - Factual questions to research (costs, timelines, comparisons, best practices, requirements, risks)
2. "guidance_needed" - How-to guidance the person needs (practical steps, strategies, approaches)

Be thorough and holistic - cover financial, practical, emotional, logistical, and strategic aspects. Aim for 10-20 research questions and 5-13 guidance items.

IMPORTANT: Respond with ONLY a JSON object, no other text:
{"research_questions": ["...", "..."], "guidance_needed": ["...", "..."]}`

  const response = await withRetry(() => callClaude(claudeApiKey, prompt))

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    const parsed = JSON.parse(jsonMatch[0])
    return {
      research_questions: parsed.research_questions || [],
      guidance_needed: parsed.guidance_needed || [],
    }
  } catch {
    throw new Error('Failed to parse AI-generated topics')
  }
}

// --- Master Plan (Cross-Goal Synthesis) ---

function readAllContextFiles(): { name: string; content: string }[] {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const memoryDir = path.join(homeDir, '.claude', 'memory')
    if (!fs.existsSync(memoryDir)) return []
    return fs.readdirSync(memoryDir)
      .filter(f => f.endsWith('.md'))
      .map(name => ({
        name,
        content: fs.readFileSync(path.join(memoryDir, name), 'utf-8')
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {}
  return []
}

// ~4 chars per token, leave room for goals+research+output
const CONTEXT_FILE_TOKEN_BUDGET = 100000
const CHARS_PER_TOKEN = 4
const CONTEXT_CHAR_BUDGET = CONTEXT_FILE_TOKEN_BUDGET * CHARS_PER_TOKEN // ~400K chars

function buildMasterPlanPrompt(goals: RoadmapGoal[]): string {
  // Load ALL context files as global knowledge base
  const allContextFiles = readAllContextFiles()

  // Smart budgeting: prioritize files attached to goals, then by size (smaller first to fit more)
  const attachedNames = new Set(goals.flatMap(g => g.contextFiles || []))
  const prioritized = [
    ...allContextFiles.filter(f => attachedNames.has(f.name)),
    ...allContextFiles.filter(f => !attachedNames.has(f.name)),
  ]

  let globalContext = ''
  let charBudgetRemaining = CONTEXT_CHAR_BUDGET
  let includedCount = 0
  let truncatedCount = 0

  if (prioritized.length > 0) {
    globalContext = `\n# Your Knowledge Base (${allContextFiles.length} context files)\n`
    globalContext += `Use ALL of this context to inform your plan. This is the user's accumulated knowledge, decisions, patterns, and notes.\n`

    for (const file of prioritized) {
      if (charBudgetRemaining <= 0) {
        truncatedCount++
        continue
      }

      let content = file.content
      if (content.length > charBudgetRemaining) {
        content = content.slice(0, charBudgetRemaining) + '\n\n[... truncated, file continues ...]'
      }
      charBudgetRemaining -= content.length
      globalContext += `\n## ${file.name}\n`
      globalContext += content + '\n'
      includedCount++
    }

    if (truncatedCount > 0) {
      globalContext += `\n_Note: ${truncatedCount} additional context file(s) omitted due to size limits._\n`
    }
    globalContext += '\n---\n'
    console.log(`Master plan: included ${includedCount}/${allContextFiles.length} context files (${truncatedCount} omitted, ${Math.round((CONTEXT_CHAR_BUDGET - charBudgetRemaining) / 1000)}K chars used of ${CONTEXT_CHAR_BUDGET / 1000}K budget)`)
  }

  let goalsContext = ''
  for (const goal of goals) {
    goalsContext += `\n## Goal: ${goal.title}\n`
    goalsContext += `Category: ${goal.category}\n`
    if (goal.description) goalsContext += `Description: ${goal.description}\n`
    if (goal.personalContext) goalsContext += `\n### Personal Context (from user):\n${goal.personalContext}\n`

    // Note which context files are specifically attached to this goal
    if (goal.contextFiles && goal.contextFiles.length > 0) {
      goalsContext += `\n_Especially relevant context files: ${goal.contextFiles.join(', ')}_\n`
    }

    const reports = (goal.topicReports || []).filter(r => r.type !== 'action_plan')
    const actionPlan = (goal.topicReports || []).find(r => r.type === 'action_plan')

    if (reports.length > 0) {
      goalsContext += `\n### Research Reports (${reports.length} topics researched):\n`
      for (const r of reports) {
        goalsContext += `\n**${r.type === 'question' ? 'Research' : 'Guidance'}: ${r.topic}**\n`
        const condensed = r.report.length > 1500 ? r.report.slice(0, 1500) + '...' : r.report
        goalsContext += condensed + '\n'
      }
    }

    if (actionPlan) {
      goalsContext += `\n### Action Plan:\n`
      const condensed = actionPlan.report.length > 2000 ? actionPlan.report.slice(0, 2000) + '...' : actionPlan.report
      goalsContext += condensed + '\n'
    }

    goalsContext += '\n---\n'
  }

  return `You are a strategic life planner. You have the user's full knowledge base AND their goals with research. Use EVERYTHING — context files, research reports, personal notes, past decisions, learned patterns — to create the most informed, personalized plan possible. Be brutally concise. Steps first, reasoning last. No filler, no motivational language.

${globalContext}
# Goals & Research
${goalsContext}

---

Create a Master Plan with EXACTLY these 3 sections:

## 1. Action Steps (by priority)
For each goal: numbered list of specific next actions, ordered by urgency.
Each step: what to do, when, expected outcome. One line per step. Most important actions first.
Draw on the context files — reference past decisions, known patterns, project state, and learnings when relevant.

## 2. Timeline
Phase breakdown: what to do in weeks 1-2, 3-4, month 2-3, month 3-6.
Just the actions, no filler. Include which goals to focus on per phase and key milestones.

## 3. Reasoning & Analysis
Why this ordering. Cross-goal synergies and conflicts. Risk flags.
Key metrics to track. Resource allocation notes (time/money per goal).
Flag unrealistic combinations. Reference relevant context from the knowledge base.

Be direct and practical. No fluff.`
}

function masterPlanWithCli(cliPath: string, goals: RoadmapGoal[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpDir = process.env.TEMP || process.env.TMP || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Temp') : '/tmp')
    const tmpFile = path.join(tmpDir, `mega-masterplan-${Date.now()}.md`)

    fs.writeFileSync(tmpFile, buildMasterPlanPrompt(goals), 'utf-8')

    const cliPrompt = `Read the master plan instructions at "${tmpFile}" and execute them. Synthesize all goals into a unified master plan. Return only the master plan directly as text. Do NOT create or write any files.`

    const proc = spawnProcess(cliPath, ['-p', cliPrompt, '--max-turns', '5'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv(),
    })

    let output = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      try { fs.unlinkSync(tmpFile) } catch {}
      reject(new Error('CLI master plan timed out after 5 minutes'))
    }, 300000)

    proc.stdout?.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      try { fs.unlinkSync(tmpFile) } catch {}
      if (code === 0 && output.trim().length > 100) {
        resolve(output.trim())
      } else {
        reject(new Error(`CLI exited ${code}: ${stderr.slice(0, 300) || 'no output'}`))
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      try { fs.unlinkSync(tmpFile) } catch {}
      reject(err)
    })
  })
}

export async function generateMasterPlan(
  goals: RoadmapGoal[],
  claudeApiKey: string
): Promise<string> {
  const cliPath = findClaudeCli()

  if (cliPath) {
    try {
      return await masterPlanWithCli(cliPath, goals)
    } catch (err) {
      console.log(`CLI master plan failed, falling back to API: ${(err as Error).message}`)
    }
  }

  // Fallback: API call (no web search needed — synthesis only)
  const prompt = buildMasterPlanPrompt(goals)
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    })
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': claudeApiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            const text = (parsed.content || [])
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n')
            resolve(text || 'No master plan generated')
          }
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(300000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

// --- Action Plan ---

export async function generateActionPlan(
  goal: RoadmapGoal & { topicReports?: { topic: string; type: string; report: string; generatedAt: string }[] },
  claudeApiKey: string
): Promise<{ report: string }> {
  const reports = goal.topicReports || []
  if (reports.length === 0) {
    throw new Error('No research reports to generate an action plan from')
  }

  const reportsText = reports
    .filter(r => r.type !== 'action_plan')
    .map(r => `### ${r.type === 'question' ? 'Research' : 'Guidance'}: ${r.topic}\n\n${r.report}`)
    .join('\n\n---\n\n')

  const body = JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are a practical life coach. Based on the research reports below for this goal, create a clear, prioritized action plan.

## Goal: ${goal.title}
${goal.description ? `Description: ${goal.description}` : ''}

## Research Reports:

${reportsText}

---

Create a **Best Steps** action plan:
1. List the most important actions in priority order (most urgent first)
2. For each action, include WHY it matters and a concrete next step
3. Group related actions together
4. Note any deadlines or time-sensitive items
5. Keep it practical — what should they actually DO this week, this month, and longer-term

Be direct and specific. No fluff.`
    }]
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': claudeApiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            const text = (parsed.content || [])
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n\n')
            resolve({ report: text || 'No action plan generated' })
          }
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

// --- Context Questions ---

export async function generateContextQuestions(
  goals: RoadmapGoal[],
  claudeApiKey: string
): Promise<{ goalId: string; questions: string[] }[]> {
  const goalsInfo = goals.map(g => `- "${g.title}" (${g.category}): ${g.description || 'No description'}`).join('\n')

  const prompt = `You are helping personalize a life planning session. For each goal below, generate 2-3 specific context questions to ask the user BEFORE generating their master plan. Questions should help understand their current situation, constraints, and progress.

Goals:
${goalsInfo}

For each goal, ask about:
- What they've already done or started
- Current budget/resources available
- Known blockers or constraints
- Timeline urgency

IMPORTANT: Respond with ONLY a JSON array, no other text:
[{"goalId": "...", "questions": ["...", "..."]}, ...]

Use these exact goal IDs: ${goals.map(g => g.id).join(', ')}`

  const response = await withRetry(() => callClaude(claudeApiKey, prompt))

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON found')
    return JSON.parse(jsonMatch[0])
  } catch {
    // Fallback: return generic questions for each goal
    return goals.map(g => ({
      goalId: g.id,
      questions: [
        `What have you already done toward "${g.title}"?`,
        'What is your current budget or resources for this?',
        'Are there any blockers or constraints?'
      ]
    }))
  }
}

// --- Extract Tasks from Plan ---

export async function extractTasksFromPlan(
  planContent: string,
  goals: RoadmapGoal[],
  claudeApiKey: string
): Promise<{ title: string; description: string; priority: 'critical' | 'high' | 'medium' | 'low'; goalId: string; goalTitle: string; phase: string }[]> {
  const goalMap = goals.map(g => `"${g.id}": "${g.title}"`).join(', ')

  const prompt = `Extract 10-30 actionable tasks from this master plan. Each task should be a concrete, executable action that could be given to an AI coding assistant or done by the user.

Master Plan:
${planContent.slice(0, 12000)}

Goal ID mapping: {${goalMap}}

IMPORTANT: Respond with ONLY a JSON array, no other text:
[{
  "title": "Short actionable title (max 80 chars)",
  "description": "Detailed description of what to do, including specific steps",
  "priority": "critical|high|medium|low",
  "goalId": "matching goal ID from above",
  "goalTitle": "matching goal title",
  "phase": "Phase name from the plan (e.g. Phase 1, Week 1, etc.)"
}, ...]

Order by priority (critical first), then by phase order. Focus on the Next 7-Day Actions and Phase 1 items as highest priority.`

  const response = await withRetry(() => callClaude(claudeApiKey, prompt))

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON found')
    const tasks = JSON.parse(jsonMatch[0])
    return tasks.map((t: any) => ({
      title: String(t.title || '').slice(0, 120),
      description: String(t.description || ''),
      priority: ['critical', 'high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      goalId: String(t.goalId || ''),
      goalTitle: String(t.goalTitle || ''),
      phase: String(t.phase || 'Unphased')
    }))
  } catch {
    throw new Error('Failed to parse extracted tasks from AI response')
  }
}

// --- Save Master Plan File ---

export function saveMasterPlanFile(content: string, date: string): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const dir = path.join(homeDir, '.claude', 'master-plans')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const filePath = path.join(dir, `${date}.md`)
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}
