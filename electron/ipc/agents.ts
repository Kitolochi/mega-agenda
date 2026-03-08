import { ipcMain, BrowserWindow } from 'electron'
import {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  setAgentStatus,
  getAgentIssues,
  getAgentIssue,
  createAgentIssue,
  updateAgentIssue,
  deleteAgentIssue,
  getHeartbeatRuns,
  updateHeartbeatRun,
  getCostEvents,
  getAgentCostSummary,
} from '../database'
import {
  executeAgentHeartbeat,
  checkoutNextIssue,
  pollAgentSessions,
} from '../agents'

let launchFn: ((opts: { prompt: string; cwd: string; env: NodeJS.ProcessEnv; title?: string; allowedTools?: string }) => void) | null = null

export function setAgentLaunchFn(fn: typeof launchFn) {
  launchFn = fn
}

export function registerAgentHandlers(mainWindow: BrowserWindow) {
  // --- Agents ---
  ipcMain.handle('get-agents', () => {
    return getAgents()
  })

  ipcMain.handle('get-agent', (_, id: string) => {
    return getAgent(id)
  })

  ipcMain.handle('create-agent', (_, data) => {
    const agent = createAgent(data)
    mainWindow?.webContents.send('agents-updated')
    return agent
  })

  ipcMain.handle('update-agent', (_, id: string, updates) => {
    const agent = updateAgent(id, updates)
    mainWindow?.webContents.send('agents-updated')
    return agent
  })

  ipcMain.handle('delete-agent', (_, id: string) => {
    deleteAgent(id)
    mainWindow?.webContents.send('agents-updated')
  })

  ipcMain.handle('set-agent-status', (_, id: string, status: string, lastError?: string) => {
    const agent = setAgentStatus(id, status as any, lastError)
    mainWindow?.webContents.send('agents-updated')
    return agent
  })

  // --- Agent Issues ---
  ipcMain.handle('get-agent-issues', (_, filters?: any) => {
    return getAgentIssues(filters)
  })

  ipcMain.handle('get-agent-issue', (_, id: string) => {
    return getAgentIssue(id)
  })

  ipcMain.handle('create-agent-issue', (_, data) => {
    const issue = createAgentIssue(data)
    mainWindow?.webContents.send('agents-updated')
    return issue
  })

  ipcMain.handle('update-agent-issue', (_, id: string, updates) => {
    const issue = updateAgentIssue(id, updates)
    mainWindow?.webContents.send('agents-updated')
    return issue
  })

  ipcMain.handle('delete-agent-issue', (_, id: string) => {
    deleteAgentIssue(id)
    mainWindow?.webContents.send('agents-updated')
  })

  // --- Heartbeat Runs ---
  ipcMain.handle('get-heartbeat-runs', (_, filters?: any) => {
    return getHeartbeatRuns(filters)
  })

  ipcMain.handle('run-agent-heartbeat', (_, agentId: string, issueId?: string) => {
    const agent = getAgent(agentId)
    if (!agent) return null

    let issue = issueId ? getAgentIssue(issueId) : null
    if (!issue && !issueId) {
      issue = checkoutNextIssue(agentId)
    }

    const run = executeAgentHeartbeat(agent, issue, 'manual', launchFn || undefined)
    mainWindow?.webContents.send('agents-updated')
    return run
  })

  ipcMain.handle('complete-heartbeat-run', (_, runId: string, updates: any) => {
    // Auto-generate tags from agent/issue metadata and run status
    const existingRun = getHeartbeatRuns().find(r => r.id === runId)
    const tags: string[] = []
    if (existingRun) {
      const agent = getAgent(existingRun.agentId)
      if (agent) {
        if (agent.role && agent.role !== 'custom') tags.push(agent.role)
        if (agent.adapterConfig?.taskType) tags.push(agent.adapterConfig.taskType)
      }
      const status = updates.status || existingRun.status
      if (['succeeded', 'failed', 'timed_out'].includes(status)) {
        tags.push(status === 'timed_out' ? 'timed-out' : status)
      }
      if (existingRun.issueId) {
        const issue = getAgentIssue(existingRun.issueId)
        if (issue?.priority) tags.push(issue.priority)
      }
      tags.push(existingRun.source)
    }

    const run = updateHeartbeatRun(runId, {
      ...updates,
      completedAt: new Date().toISOString(),
      durationMs: updates.durationMs,
      tags: tags.length > 0 ? tags : undefined,
    })
    if (run) {
      const agent = getAgent(run.agentId)
      if (agent && agent.status === 'running') {
        setAgentStatus(agent.id, 'idle')
      }
      if (run.issueId && updates.status === 'succeeded') {
        updateAgentIssue(run.issueId, { status: 'in_review', result: updates.summary })
      }
    }
    mainWindow?.webContents.send('agents-updated')
    return run
  })

  // --- Cost Events ---
  ipcMain.handle('get-cost-events', (_, filters?: any) => {
    return getCostEvents(filters)
  })

  ipcMain.handle('get-agent-cost-summary', (_, agentId: string) => {
    return getAgentCostSummary(agentId)
  })

  // --- Session Polling ---
  ipcMain.handle('poll-agent-sessions', async () => {
    await pollAgentSessions()
    return getHeartbeatRuns({ limit: 20 })
  })
}
