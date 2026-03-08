import { Notification } from 'electron'
import {
  getAgents,
  getAgent,
  getAgentIssue,
  getAgentIssues,
  setAgentStatus,
  updateAgent,
  updateAgentIssue,
  createHeartbeatRun,
  updateHeartbeatRun,
  getHeartbeatRuns,
  createCostEvent,
  getCostEvents,
  type Agent,
  type AgentIssue,
  type HeartbeatRun,
} from './database'
import { findSessionByPromptFragment, getSessionFilePath, isSessionComplete, extractSessionResult } from './cli-logs'

// Token pricing (per million tokens, in cents)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 1500, output: 7500 },
  'claude-sonnet-4-5-20250929': { input: 300, output: 1500 },
  'claude-haiku-4-5-20251001': { input: 80, output: 400 },
}

function estimateCostCents(inputTokens: number, outputTokens: number, model = 'claude-sonnet-4-5-20250929'): number {
  const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['claude-sonnet-4-5-20250929']
  return Math.round((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000)
}

function getAgentConfig(taskType?: string): { preamble: string; allowedTools: string } {
  switch (taskType) {
    case 'research':
      return {
        preamble: 'You are a research specialist. Focus on gathering information, analyzing sources, and producing well-organized findings.',
        allowedTools: '"Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" "Write(*)"',
      }
    case 'code':
      return {
        preamble: 'You are a software engineering specialist. Write clean, working code. Follow best practices and create production-ready implementations.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)"',
      }
    case 'writing':
      return {
        preamble: 'You are a writing specialist. Produce clear, well-structured content with appropriate tone.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'planning':
      return {
        preamble: 'You are a strategic planning specialist. Create detailed, actionable plans with clear milestones.',
        allowedTools: '"Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'communication':
      return {
        preamble: 'You are a communication specialist. Draft professional, clear communications.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    default:
      return {
        preamble: 'You are a capable AI assistant. Complete the assigned task thoroughly.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
  }
}

// --- Module-level launch function for retry support ---
type LaunchFn = (opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void
let storedLaunchFn: LaunchFn | null = null

/** Store the terminal launcher so pollAgentSessions can retry launches */
export function setLaunchFn(fn: LaunchFn): void {
  storedLaunchFn = fn
}

/** Complete a heartbeat run with auto-generated tags and status transitions */
export function completeRun(runId: string, updates: { status: HeartbeatRun['status']; summary?: string; durationMs?: number; inputTokens?: number; outputTokens?: number; costCents?: number; error?: string }): HeartbeatRun | null {
  const existingRun = getHeartbeatRuns().find(r => r.id === runId)
  if (!existingRun) return null

  // Auto-generate tags
  const tags: string[] = []
  const agent = getAgent(existingRun.agentId)
  if (agent) {
    if (agent.role && agent.role !== 'custom') tags.push(agent.role)
    if (agent.adapterConfig?.taskType) tags.push(agent.adapterConfig.taskType)
  }
  if (['succeeded', 'failed', 'timed_out'].includes(updates.status)) {
    tags.push(updates.status === 'timed_out' ? 'timed-out' : updates.status)
  }
  if (existingRun.issueId) {
    const issue = getAgentIssue(existingRun.issueId)
    if (issue?.priority) tags.push(issue.priority)
  }
  tags.push(existingRun.source)

  const run = updateHeartbeatRun(runId, {
    ...updates,
    completedAt: new Date().toISOString(),
    tags: tags.length > 0 ? tags : undefined,
  })

  if (run) {
    // Reset agent to idle
    if (agent && agent.status === 'running') {
      setAgentStatus(agent.id, 'idle')
    }
    // Move issue to in_review on success
    if (run.issueId && updates.status === 'succeeded') {
      updateAgentIssue(run.issueId, { status: 'in_review', result: updates.summary })
    }
  }

  return run
}

/** Requeue an issue back to todo so it can be picked up again */
export function requeueIssue(issueId: string): void {
  updateAgentIssue(issueId, {
    status: 'todo',
    checkedOutAt: undefined,
    checkedOutRunId: undefined,
  })
}

/** Show a desktop notification when an agent hits its budget threshold */
export function emitBudgetAlert(agent: Agent, ratio: number): void {
  const pct = Math.round(ratio * 100)
  new Notification({
    title: `Agent Budget Alert: ${agent.name}`,
    body: `${pct}% of monthly budget used ($${(agent.spentMonthlyCents / 100).toFixed(2)} / $${(agent.budgetMonthlyCents / 100).toFixed(2)}). Agent paused.`,
  }).show()
}

/** Check if an agent's heartbeat is due (mirrors isRoutineDue logic from routines.ts) */
export function isAgentHeartbeatDue(agent: Agent): boolean {
  if (agent.status === 'paused') return false
  if (!agent.heartbeat?.enabled) return false
  if (agent.status === 'running') return false

  const now = new Date()
  const { schedule, lastRun } = agent.heartbeat

  switch (schedule.trigger) {
    case 'interval': {
      const mins = schedule.intervalMinutes || 60
      if (!lastRun) return true
      const elapsed = (now.getTime() - new Date(lastRun).getTime()) / 60000
      return elapsed >= mins
    }
    case 'daily': {
      const today = now.toISOString().split('T')[0]
      if (lastRun && lastRun.split('T')[0] === today) return false
      if (schedule.time) {
        const [h, m] = schedule.time.split(':').map(Number)
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        return nowMinutes >= h * 60 + m
      }
      return true
    }
    case 'weekly': {
      const today = now.toISOString().split('T')[0]
      if (lastRun && lastRun.split('T')[0] === today) return false
      const targetDay = schedule.dayOfWeek ?? 1
      if (now.getDay() !== targetDay) return false
      if (schedule.time) {
        const [h, m] = schedule.time.split(':').map(Number)
        const nowMinutes = now.getHours() * 60 + now.getMinutes()
        return nowMinutes >= h * 60 + m
      }
      return true
    }
    default:
      return false
  }
}

/** Find the next todo issue assigned to an agent and check it out */
export function checkoutNextIssue(agentId: string): AgentIssue | null {
  const issues = getAgentIssues({ agentId, status: 'todo' })
  if (issues.length === 0) return null
  // issues already sorted by priority from getAgentIssues
  const issue = issues[0]
  const now = new Date().toISOString()
  updateAgentIssue(issue.id, {
    status: 'in_progress',
    checkedOutAt: now,
  })
  return { ...issue, status: 'in_progress', checkedOutAt: now }
}

/** Build the prompt for an agent heartbeat */
function buildAgentPrompt(agent: Agent, issue?: AgentIssue | null): string {
  const config = agent.adapterConfig
  const agentConfig = getAgentConfig(config.taskType)
  const preamble = config.preamble || agentConfig.preamble

  const parts: string[] = [preamble, '']

  parts.push(`[Agent: ${agent.name} | Role: ${agent.role}]`)
  parts.push('')

  if (issue) {
    parts.push(`ASSIGNED ISSUE: ${issue.title}`)
    if (issue.description) parts.push(`DESCRIPTION: ${issue.description}`)
    parts.push(`PRIORITY: ${issue.priority}`)
    if (issue.tags.length > 0) parts.push(`TAGS: ${issue.tags.join(', ')}`)
    parts.push('')
    parts.push('Please work on this issue autonomously. Read relevant files, implement changes, and verify your work.')
    parts.push('When done, provide a brief summary of what you accomplished.')
  } else {
    parts.push('No specific issue assigned. Check your working directory for any pending work or improvements to make.')
  }

  return parts.join('\n')
}

/** Execute a heartbeat for an agent — launches external terminal with Claude Code */
export function executeAgentHeartbeat(
  agent: Agent,
  issue?: AgentIssue | null,
  source: HeartbeatRun['source'] = 'timer',
  launchFn?: (opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void
): HeartbeatRun {
  const prompt = buildAgentPrompt(agent, issue)
  const config = agent.adapterConfig
  const agentConfig = getAgentConfig(config.taskType)
  const allowedTools = config.allowedTools || agentConfig.allowedTools
  const cwd = config.cwd || process.cwd()
  const now = new Date().toISOString()

  // Create the heartbeat run record
  const run = createHeartbeatRun({
    agentId: agent.id,
    issueId: issue?.id,
    source,
    status: 'running',
    prompt,
    startedAt: now,
  })

  // Update issue with run reference
  if (issue) {
    updateAgentIssue(issue.id, { checkedOutRunId: run.id })
  }

  // Update agent status
  updateAgent(agent.id, {
    status: 'running',
    heartbeat: {
      ...agent.heartbeat!,
      lastRun: now,
    },
  })

  // Launch in external terminal
  if (launchFn) {
    try {
      launchFn({
        prompt,
        cwd,
        env: process.env,
        title: `Agent: ${agent.name}`,
        allowedTools,
      })
    } catch (err: any) {
      updateHeartbeatRun(run.id, {
        status: 'failed',
        error: err.message,
        completedAt: new Date().toISOString(),
      })
      updateAgent(agent.id, { status: 'error', lastError: err.message })
    }
  }

  return run
}

/** Run all due agent heartbeats */
export function runDueAgentHeartbeats(
  launchFn?: (opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void
): HeartbeatRun[] {
  const agents = getAgents()
  const results: HeartbeatRun[] = []

  for (const agent of agents) {
    if (!isAgentHeartbeatDue(agent)) continue

    // Check budget
    if (agent.budgetMonthlyCents > 0 && agent.spentMonthlyCents >= agent.budgetMonthlyCents) {
      continue
    }

    // Try to check out an issue
    const issue = checkoutNextIssue(agent.id)
    const run = executeAgentHeartbeat(agent, issue, 'timer', launchFn)
    results.push(run)
  }

  return results
}

/** Poll running agent sessions to detect completion */
export async function pollAgentSessions(): Promise<void> {
  const runningRuns = getHeartbeatRuns().filter(r => r.status === 'running')

  for (const run of runningRuns) {
    try {
      // Try to find the session by looking for the prompt fragment
      const fragment = run.prompt.slice(0, 80)
      const sessionId = await findSessionByPromptFragment(fragment, run.startedAt)

      if (sessionId && sessionId !== run.sessionId) {
        updateHeartbeatRun(run.id, { sessionId })
      }

      // Check if a running run has been going for too long (2 hours)
      const elapsed = Date.now() - new Date(run.startedAt).getTime()
      if (elapsed > 2 * 60 * 60 * 1000) {
        updateHeartbeatRun(run.id, {
          status: 'timed_out',
          completedAt: new Date().toISOString(),
          durationMs: elapsed,
        })
        const agent = getAgent(run.agentId)
        if (agent) {
          updateAgent(agent.id, { status: 'idle' })
        }
      }
    } catch (err) {
      console.error(`[agents] Poll error for run ${run.id}:`, err)
    }
  }
}

/** Aggregate cost events for an agent and update spentMonthlyCents */
export function aggregateAgentCosts(agentId: string): void {
  const agent = getAgent(agentId)
  if (!agent) return

  const firstOfMonth = new Date().toISOString().slice(0, 8) + '01'

  // Reset budget if new month
  if (agent.budgetResetDate !== firstOfMonth) {
    updateAgent(agentId, { budgetResetDate: firstOfMonth, spentMonthlyCents: 0 })
    return
  }

  const events = getCostEvents({ agentId })
  const monthEvents = events.filter(e => e.timestamp >= firstOfMonth)
  const monthCents = monthEvents.reduce((sum, e) => sum + e.costCents, 0)

  updateAgent(agentId, { spentMonthlyCents: monthCents })
}

export { estimateCostCents, getAgentConfig as getAgentConfigForType }
