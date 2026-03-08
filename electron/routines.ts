import { execFile } from 'child_process'
import { Notification } from 'electron'
import {
  getRoutines,
  getBriefingData,
  getDailyAgenda,
  getWeeklyReviewData,
  saveRoutineResult,
  setRoutineLastRun,
  type Routine,
  type RoutineResult,
} from './database'

// --- Executor functions ---

function executeMorningBriefing(): { summary: string; detail: string } {
  const today = new Date().toISOString().split('T')[0]
  const briefing = getBriefingData()
  const agenda = getDailyAgenda(today)

  const overdue = briefing.overdueTasks.length
  const todayCount = briefing.todayTasks.length
  const highPri = briefing.highPriorityTasks.length
  const eventCount = agenda.events.length

  const summaryParts: string[] = []
  if (overdue > 0) summaryParts.push(`${overdue} overdue`)
  if (todayCount > 0) summaryParts.push(`${todayCount} due today`)
  if (eventCount > 0) summaryParts.push(`${eventCount} events`)
  const summary = summaryParts.length > 0
    ? summaryParts.join(', ')
    : 'All clear — nothing pending'

  const lines: string[] = ['## Morning Briefing', '']
  if (overdue > 0) {
    lines.push(`### Overdue (${overdue})`)
    briefing.overdueTasks.slice(0, 10).forEach(t => lines.push(`- ${t.title} (due ${t.due_date})`))
    lines.push('')
  }
  if (todayCount > 0) {
    lines.push(`### Due Today (${todayCount})`)
    briefing.todayTasks.slice(0, 10).forEach(t => lines.push(`- ${t.title}`))
    lines.push('')
  }
  if (highPri > 0) {
    lines.push(`### High Priority (${highPri})`)
    briefing.highPriorityTasks.slice(0, 10).forEach(t => lines.push(`- ${t.title}`))
    lines.push('')
  }
  if (eventCount > 0) {
    lines.push(`### Events (${eventCount})`)
    agenda.events.slice(0, 10).forEach(e => {
      const time = e.startTime ? ` at ${e.startTime}` : ' (all day)'
      lines.push(`- ${e.title}${time}`)
    })
    lines.push('')
  }
  lines.push(`**Streak:** ${briefing.streak} days`)

  return { summary, detail: lines.join('\n') }
}

function executePRMonitor(): Promise<{ summary: string; detail: string }> {
  return new Promise((resolve) => {
    execFile('gh', ['pr', 'status', '--json', 'currentBranch,createdBy,needsReview'], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          summary: `Error: ${error.message.split('\n')[0]}`,
          detail: `### PR Monitor Error\n\n\`\`\`\n${stderr || error.message}\n\`\`\``,
        })
        return
      }

      try {
        const data = JSON.parse(stdout)
        const created = data.createdBy?.totalCount ?? 0
        const review = data.needsReview?.totalCount ?? 0
        const current = data.currentBranch?.title ?? null

        const summaryParts: string[] = []
        if (current) summaryParts.push(`Current: "${current}"`)
        if (created > 0) summaryParts.push(`${created} authored`)
        if (review > 0) summaryParts.push(`${review} need review`)
        const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : 'No open PRs'

        const lines: string[] = ['## PR Status', '']
        if (current) lines.push(`**Current branch PR:** ${current}`, '')
        if (data.createdBy?.prs?.length) {
          lines.push(`### Authored (${created})`)
          data.createdBy.prs.forEach((pr: any) => lines.push(`- #${pr.number} ${pr.title} (${pr.state})`))
          lines.push('')
        }
        if (data.needsReview?.prs?.length) {
          lines.push(`### Needs Review (${review})`)
          data.needsReview.prs.forEach((pr: any) => lines.push(`- #${pr.number} ${pr.title}`))
          lines.push('')
        }
        resolve({ summary, detail: lines.join('\n') })
      } catch {
        resolve({ summary: 'PR status fetched', detail: `### PR Status\n\n\`\`\`\n${stdout}\n\`\`\`` })
      }
    })
  })
}

function executeEmailDigest(): Promise<{ summary: string; detail: string }> {
  return new Promise((resolve) => {
    execFile('gws', ['gmail', 'users.messages', 'list', '--userId=me', '--maxResults=10', '--q=is:unread'], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          summary: `Error: ${error.message.includes('ENOENT') ? 'gws CLI not installed' : error.message.split('\n')[0]}`,
          detail: `### Email Digest Error\n\n\`\`\`\n${stderr || error.message}\n\`\`\``,
        })
        return
      }

      try {
        const data = JSON.parse(stdout)
        const count = data.resultSizeEstimate ?? data.messages?.length ?? 0
        resolve({
          summary: `${count} unread email${count !== 1 ? 's' : ''}`,
          detail: `### Email Digest\n\n**Unread messages:** ${count}\n\n${data.messages?.map((m: any) => `- Message ID: ${m.id}`).join('\n') || 'No unread messages'}`,
        })
      } catch {
        resolve({ summary: 'Email check complete', detail: `### Email Digest\n\n\`\`\`\n${stdout}\n\`\`\`` })
      }
    })
  })
}

function executeWeeklyReview(): { summary: string; detail: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(monday.getDate() - diff)
  const weekStart = monday.toISOString().split('T')[0]

  const data = getWeeklyReviewData(weekStart)
  const completed = data.completedTasks.length
  const focus = data.focusMinutes

  const summary = `${completed} tasks completed, ${focus}min focus`

  const lines: string[] = ['## Weekly Review', '']
  lines.push(`**Week of:** ${weekStart}`)
  lines.push(`**Tasks completed:** ${completed}`)
  lines.push(`**Focus time:** ${focus} minutes`)
  lines.push(`**Categories:** ${data.categoriesWorked.join(', ') || 'None'}`)
  lines.push(`**Streak:** ${data.streak} days`)
  lines.push(`**Journal entries:** ${data.notesWritten.length}`)
  lines.push('')
  if (completed > 0) {
    lines.push('### Completed Tasks')
    data.completedTasks.slice(0, 20).forEach(t => lines.push(`- ${t.title}`))
  }

  return { summary, detail: lines.join('\n') }
}

function executeCustomCommand(config: Record<string, any>): Promise<{ summary: string; detail: string }> {
  const command = config.command || 'echo "No command configured"'
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
  const flag = process.platform === 'win32' ? '/c' : '-c'

  return new Promise((resolve) => {
    execFile(shell, [flag, command], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          summary: `Error: exit code ${error.code ?? 'unknown'}`,
          detail: `### Custom Command Error\n\n**Command:** \`${command}\`\n\n**stderr:**\n\`\`\`\n${stderr || error.message}\n\`\`\`\n\n**stdout:**\n\`\`\`\n${stdout || '(empty)'}\n\`\`\``,
        })
        return
      }
      const output = stdout.trim()
      const summaryLine = output.split('\n')[0].slice(0, 100) || 'Command completed'
      resolve({
        summary: summaryLine,
        detail: `### Custom Command\n\n**Command:** \`${command}\`\n\n\`\`\`\n${output || '(no output)'}\n\`\`\``,
      })
    })
  })
}

// --- Scheduler logic ---

export async function executeRoutine(routine: Routine): Promise<RoutineResult> {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  let summary: string
  let detail: string
  let status: 'success' | 'error' = 'success'

  try {
    let result: { summary: string; detail: string }
    switch (routine.type) {
      case 'morning-briefing':
        result = executeMorningBriefing()
        break
      case 'pr-monitor':
        result = await executePRMonitor()
        break
      case 'email-digest':
        result = await executeEmailDigest()
        break
      case 'weekly-review':
        result = executeWeeklyReview()
        break
      case 'custom':
        result = await executeCustomCommand(routine.config)
        break
      default:
        result = { summary: 'Unknown routine type', detail: 'No executor found for this routine type.' }
        status = 'error'
    }
    summary = result.summary
    detail = result.detail
    // Mark as error if summary starts with "Error:"
    if (summary.startsWith('Error:')) status = 'error'
  } catch (err: any) {
    summary = `Error: ${err.message || 'Unknown error'}`
    detail = `### Routine Error\n\n\`\`\`\n${err.stack || err.message}\n\`\`\``
    status = 'error'
  }

  const saved = saveRoutineResult({
    routineId: routine.id,
    timestamp: now.toISOString(),
    summary,
    detail,
    status,
    date: today,
  })

  setRoutineLastRun(routine.id, now.toISOString())
  return saved
}

export function notifyRoutineResult(routine: Routine, result: RoutineResult): void {
  try {
    new Notification({
      title: routine.name,
      body: result.summary,
    }).show()
  } catch { /* notification not supported in some environments */ }
}

export function isRoutineDue(routine: Routine): boolean {
  if (!routine.enabled) return false

  const now = new Date()
  const { schedule, lastRun } = routine

  switch (schedule.trigger) {
    case 'app-launch': {
      // Once per day
      if (!lastRun) return true
      const lastDate = lastRun.split('T')[0]
      const today = now.toISOString().split('T')[0]
      return lastDate !== today
    }
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
      const targetDay = schedule.dayOfWeek ?? 1 // default Monday
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

export async function runDueRoutines(): Promise<RoutineResult[]> {
  const routines = getRoutines()
  const results: RoutineResult[] = []
  for (const routine of routines) {
    if (isRoutineDue(routine)) {
      const result = await executeRoutine(routine)
      notifyRoutineResult(routine, result)
      results.push(result)
    }
  }
  return results
}

export async function runAppLaunchRoutines(): Promise<RoutineResult[]> {
  const routines = getRoutines().filter(r => r.enabled && r.schedule.trigger === 'app-launch')
  const results: RoutineResult[] = []
  for (const routine of routines) {
    if (isRoutineDue(routine)) {
      const result = await executeRoutine(routine)
      notifyRoutineResult(routine, result)
      results.push(result)
    }
  }
  return results
}
