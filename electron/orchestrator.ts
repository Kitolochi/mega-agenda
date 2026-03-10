import { ChildProcess, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { findClaudeCli } from './research'

// --- Types ---

export interface OrchestratorTask {
  title: string
  description: string
  priority: string
  taskType?: string
  resultFile: string
}

export interface OrchestratorOpts {
  id: string
  goalTitle: string
  tasks: OrchestratorTask[]
  workspaceFile: string
  repoDir: string
  deliverablesDir: string
  agentResultsDir: string
}

// --- Active orchestrator processes ---

const activeOrchestrators = new Map<string, ChildProcess>()

// --- Prompt builder ---

function getTaskTypeHint(taskType?: string): string {
  switch (taskType) {
    case 'research': return 'Focus on gathering information and producing findings.'
    case 'code': return 'Write clean, working code with appropriate error handling.'
    case 'writing': return 'Produce clear, well-structured content.'
    case 'planning': return 'Create detailed, actionable plans.'
    case 'communication': return 'Draft professional, clear communications.'
    default: return ''
  }
}

export function buildOrchestratorPrompt(opts: OrchestratorOpts): string {
  const taskEntries = opts.tasks.map((t, i) => {
    const hint = getTaskTypeHint(t.taskType)
    return [
      `### Task ${i + 1}: ${t.title} (Priority: ${t.priority}${t.taskType ? ', Type: ' + t.taskType : ''})`,
      t.description,
      hint ? `\n_Hint: ${hint}_` : '',
      `Result file: ${t.resultFile}`,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return `You are an orchestrator managing parallel tasks for: "${opts.goalTitle}"

WORKSPACE: Read ${opts.workspaceFile} for full context.
WORKING DIR: ${opts.repoDir}
DELIVERABLES: ${opts.deliverablesDir}

## Tasks

${taskEntries}

## Instructions

1. Read the workspace file and run "git log --oneline -10" for prior context.
2. Use the Task tool to dispatch independent tasks in parallel. Group dependent tasks sequentially.
3. For each completed task, write a result file to ${opts.agentResultsDir}/ using this format:
   # Task: {title}
   **Status:** completed
   **Files created:** (list file paths)
   **Summary:** (what was accomplished)
4. Commit work after each task: git add -A && git commit -m "task: {title}"
5. When all tasks are done, provide a final summary listing what was completed.

Important:
- Build on existing work in the repo — check git log and existing files first.
- Save deliverables to: ${opts.deliverablesDir}
- Each task's result file path is listed above — write to those exact paths.
`
}

export function buildDailyPlanPrompt(tasks: { title: string; description: string }[]): string {
  const taskEntries = tasks.map((t, i) =>
    `### Task ${i + 1}: ${t.title}\n${t.description}`
  ).join('\n\n')

  return `You are an orchestrator executing a daily plan. Complete the following tasks efficiently.

## Tasks

${taskEntries}

## Instructions

1. Use the Task tool to dispatch independent tasks in parallel.
2. For each task, produce the deliverable described.
3. Provide a final summary when all tasks are done.
`
}

// --- Lifecycle ---

export function launchOrchestrator(
  id: string,
  prompt: string,
  cwd: string,
  onOutput: (line: string) => void,
  onDone: (code: number | null) => void,
): void {
  const cliPath = findClaudeCli()
  if (!cliPath) {
    onOutput('[orchestrator] Claude CLI not found. Install with: npm i -g @anthropic-ai/claude-code')
    onDone(1)
    return
  }

  // Kill any existing orchestrator with same id
  stopOrchestrator(id)

  const tmpDir = path.join(app.getPath('temp'), 'mega-agenda', 'orchestrator')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, `${id}-${Date.now()}.md`)
  fs.writeFileSync(tmpFile, prompt, 'utf-8')

  const cliPrompt = `Read the orchestrator instructions at "${tmpFile}" and execute them.`

  const env = { ...process.env }
  delete env.CLAUDECODE

  const proc = spawn(cliPath, ['-p', cliPrompt, '--max-turns', '50', '--dangerously-skip-permissions'], {
    shell: true,
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  })

  activeOrchestrators.set(id, proc)
  onOutput(`[orchestrator] Started (id: ${id}, pid: ${proc.pid})`)

  // Stream stdout line-by-line
  let stdoutBuf = ''
  proc.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString()
    const lines = stdoutBuf.split('\n')
    stdoutBuf = lines.pop() || ''
    for (const line of lines) {
      if (line.trim()) onOutput(line)
    }
  })

  // Stream stderr
  let stderrBuf = ''
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString()
    const lines = stderrBuf.split('\n')
    stderrBuf = lines.pop() || ''
    for (const line of lines) {
      if (line.trim()) onOutput(`[stderr] ${line}`)
    }
  })

  // 30-minute timeout
  const timer = setTimeout(() => {
    onOutput('[orchestrator] Timed out after 30 minutes — killing process')
    proc.kill()
  }, 30 * 60 * 1000)

  proc.on('close', (code) => {
    clearTimeout(timer)
    activeOrchestrators.delete(id)
    // Flush remaining buffers
    if (stdoutBuf.trim()) onOutput(stdoutBuf.trim())
    if (stderrBuf.trim()) onOutput(`[stderr] ${stderrBuf.trim()}`)
    onOutput(`[orchestrator] Exited with code ${code}`)
    // Cleanup temp file
    try { fs.unlinkSync(tmpFile) } catch {}
    onDone(code)
  })

  proc.on('error', (err) => {
    clearTimeout(timer)
    activeOrchestrators.delete(id)
    onOutput(`[orchestrator] Error: ${err.message}`)
    try { fs.unlinkSync(tmpFile) } catch {}
    onDone(1)
  })
}

export function stopOrchestrator(id: string): boolean {
  const proc = activeOrchestrators.get(id)
  if (!proc) return false
  proc.kill()
  activeOrchestrators.delete(id)
  return true
}

export function isOrchestratorRunning(id: string): boolean {
  return activeOrchestrators.has(id)
}

/** Kill all orchestrators — call from app before-quit */
export function killAllOrchestrators(): void {
  for (const [id, proc] of activeOrchestrators) {
    try { proc.kill() } catch {}
    activeOrchestrators.delete(id)
  }
}
