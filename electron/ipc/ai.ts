import { ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, execSync } from 'child_process'
import { app } from 'electron'
import { getClaudeApiKey, saveClaudeApiKey, getLLMSettings, saveLLMSettings, getRoadmapGoals, updateRoadmapGoal, getMasterPlan, saveMasterPlan, clearMasterPlan, getMasterPlanTasks, createMasterPlanTask, updateMasterPlanTask, clearMasterPlanTasks, getCategories, getWeeklyReviewData } from '../database'
import { summarizeAI, summarizeGeo, verifyClaudeKey, parseVoiceCommand } from '../summarize'
import { verifyLLMKey, PROVIDER_MODELS, PROVIDER_CHAT_MODELS, getCurrentModelInfo, isLLMConfigured } from '../llm'
import { researchTopicSmart, generateActionPlan, generateTopics, generateMasterPlan, findClaudeCli, generateContextQuestions, extractTasksFromPlan, extractTasksFromActionPlan, saveMasterPlanFile } from '../research'
import { findSessionByPromptFragment } from '../cli-logs'
import { extractMemoriesFromAgentResult } from '../memory'
import { streamSmartQuery } from '../smart-query'

// --- Helper functions ---

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Get a stable, length-safe goal directory path.
 */
function getGoalDir(goal: { id: string; title: string }): string {
  const goalsRoot = path.join(getMemoryDir(), 'goals')
  const slug = slugify(goal.title).slice(0, 60).replace(/-$/, '')
  const newName = `${slug}-${goal.id}`
  const newDir = path.join(goalsRoot, newName)

  if (fs.existsSync(newDir)) return newDir

  const oldName = slugify(goal.title)
  if (oldName !== newName) {
    const oldDir = path.join(goalsRoot, oldName)
    if (fs.existsSync(oldDir)) {
      try {
        fs.renameSync(oldDir, newDir)
        console.log(`Migrated goal dir: ${oldName} -> ${newName}`)
        return newDir
      } catch (err) {
        console.error(`Failed to migrate goal dir ${oldName}:`, err)
      }
    }
  }

  return newDir
}

function writeGoalContextFile(goal: any): void {
  try {
    const goalDir = getGoalDir(goal)
    if (!fs.existsSync(goalDir)) fs.mkdirSync(goalDir, { recursive: true })

    const now = new Date().toISOString()

    const overview: string[] = []
    overview.push(`# ${goal.title}`)
    overview.push('')
    if (goal.description) { overview.push(`> ${goal.description}`); overview.push('') }
    const meta: string[] = []
    if (goal.category) meta.push(`**Category:** ${goal.category}`)
    if (goal.priority) meta.push(`**Priority:** ${goal.priority}`)
    if (goal.status) meta.push(`**Status:** ${goal.status}`)
    if (goal.target_date) meta.push(`**Target Date:** ${goal.target_date}`)
    if (meta.length > 0) { overview.push(meta.join(' | ')); overview.push('') }
    if (goal.personal_context) {
      overview.push('## Personal Context')
      overview.push('')
      overview.push(goal.personal_context)
      overview.push('')
    }

    const reports = (goal.topicReports || []).filter((r: any) => r.type !== 'action_plan')
    if (reports.length > 0) {
      overview.push('## Research Topics')
      overview.push('')
      for (const r of reports) {
        overview.push(`- [${r.topic}](./${slugify(r.topic)}.md) *(${r.type})*`)
      }
      overview.push('')
    }

    const actionPlan = (goal.topicReports || []).find((r: any) => r.type === 'action_plan')
    if (actionPlan) {
      overview.push(`- [Action Plan](./_action-plan.md)`)
      overview.push('')
    }

    overview.push('---')
    overview.push(`*Last updated: ${now}*`)
    fs.writeFileSync(path.join(goalDir, '_overview.md'), overview.join('\n'), 'utf-8')

    for (const r of (goal.topicReports || [])) {
      const topicSlug = r.type === 'action_plan' ? '_action-plan' : slugify(r.topic)
      const topicLines: string[] = []
      topicLines.push(`# ${r.topic}`)
      topicLines.push('')
      topicLines.push(`**Goal:** ${goal.title} | **Type:** ${r.type} | **Model:** ${r.model || 'claude (legacy)'} | **Generated:** ${r.generatedAt || 'unknown'}`)
      topicLines.push('')
      topicLines.push(r.report)
      topicLines.push('')
      topicLines.push('---')
      topicLines.push(`*Last updated: ${now}*`)
      fs.writeFileSync(path.join(goalDir, `${topicSlug}.md`), topicLines.join('\n'), 'utf-8')
    }

    const contextFilePath = path.join(goalDir, '_context.md')
    if (!fs.existsSync(contextFilePath)) {
      const contextContent = `# Context: ${goal.title}

Fill in any of these to help the master plan generator personalize your plan.
Delete questions that aren't relevant.

## What have you already done toward this goal?

(your answer here)

## What is your current budget or resources?

(your answer here)

## Are there any blockers or constraints?

(your answer here)

## How urgent is this — what's driving the timeline?

(your answer here)

## Any other context?

(your answer here)
`
      fs.writeFileSync(contextFilePath, contextContent, 'utf-8')
    }
  } catch (err) {
    console.error(`Failed to write goal context files for "${goal.title}":`, err)
  }
}

/** Agent config for task-type routing */
function getAgentConfig(taskType?: string): { preamble: string; allowedTools: string } {
  switch (taskType) {
    case 'research':
      return {
        preamble: 'You are a research specialist. Focus on gathering information, analyzing sources, and producing well-organized findings. Prioritize depth and accuracy.',
        allowedTools: '"Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" "Write(*)"',
      }
    case 'code':
      return {
        preamble: 'You are a software engineering specialist. Write clean, working code. Follow best practices, add appropriate error handling, and create production-ready implementations.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)"',
      }
    case 'writing':
      return {
        preamble: 'You are a writing specialist. Produce clear, well-structured content. Focus on readability, appropriate tone, and comprehensive coverage of the topic.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'planning':
      return {
        preamble: 'You are a strategic planning specialist. Create detailed, actionable plans with clear milestones, dependencies, and success criteria.',
        allowedTools: '"Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    case 'communication':
      return {
        preamble: 'You are a communication specialist. Draft professional, clear communications. Consider the audience, tone, and key messages.',
        allowedTools: '"Write(*)" "Edit(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
    default:
      return {
        preamble: 'You are a capable AI assistant. Complete the assigned task thoroughly and produce high-quality deliverables.',
        allowedTools: '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"',
      }
  }
}

// Exported for use in main.ts startup
export { getGoalDir, getMemoryDir, slugify, writeGoalContextFile }

export function syncAllGoalContextFiles(): void {
  try {
    const goals = getRoadmapGoals()
    for (const goal of goals) {
      if ((goal.topicReports || []).length > 0) {
        writeGoalContextFile(goal)
      }
    }
    console.log(`Synced ${goals.filter(g => (g.topicReports || []).length > 0).length} goal context files`)
  } catch (err) {
    console.error('Failed to sync goal context files:', err)
  }
}

export function registerAIHandlers(mainWindow: BrowserWindow) {
  // Claude API
  ipcMain.handle('get-claude-api-key', () => {
    return getClaudeApiKey()
  })

  ipcMain.handle('save-claude-api-key', (_, key: string) => {
    saveClaudeApiKey(key)
    return true
  })

  ipcMain.handle('verify-claude-key', async (_, key: string) => {
    return verifyClaudeKey(key)
  })

  // LLM Settings
  ipcMain.handle('get-llm-settings', () => {
    return getLLMSettings()
  })

  ipcMain.handle('save-llm-settings', (_, updates: any) => {
    return saveLLMSettings(updates)
  })

  ipcMain.handle('verify-llm-key', async (_, provider: string, key: string) => {
    return verifyLLMKey(provider, key)
  })

  ipcMain.handle('get-provider-models', () => {
    return PROVIDER_MODELS
  })

  ipcMain.handle('get-provider-chat-models', () => {
    return PROVIDER_CHAT_MODELS
  })

  ipcMain.handle('summarize-feed', async (_, _apiKey: string, articles: { title: string; description: string }[], section: string) => {
    if (section === 'ai') return summarizeAI(articles)
    if (section === 'geo') return summarizeGeo(articles)
    return summarizeAI(articles)
  })

  // Voice command parsing
  ipcMain.handle('parse-voice-command', async (_, _apiKey: string, transcript: string, categoryNames: string[]) => {
    return parseVoiceCommand(transcript, categoryNames)
  })

  // Generate Topics for a Goal
  ipcMain.handle('generate-topics', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find(g => g.id === goalId)
    if (!goal) throw new Error('Goal not found')

    if (!isLLMConfigured()) throw new Error('No AI provider configured. Set it in Settings.')

    const result = await generateTopics(goal)

    const existingQ = new Set(goal.research_questions)
    const existingG = new Set(goal.guidance_needed)
    const newQuestions = result.research_questions.filter(q => !existingQ.has(q))
    const newGuidance = result.guidance_needed.filter(g => !existingG.has(g))

    updateRoadmapGoal(goalId, {
      research_questions: [...goal.research_questions, ...newQuestions],
      guidance_needed: [...goal.guidance_needed, ...newGuidance],
    } as any)

    return {
      added: { questions: newQuestions.length, guidance: newGuidance.length },
      total: { questions: goal.research_questions.length + newQuestions.length, guidance: goal.guidance_needed.length + newGuidance.length }
    }
  })

  // Research All Topics for a Goal
  ipcMain.handle('research-roadmap-goal', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find(g => g.id === goalId)
    if (!goal) throw new Error('Goal not found')

    if (!isLLMConfigured()) throw new Error('No AI provider configured. Set it in Settings.')

    const allTopics = [
      ...goal.research_questions.map((q, i) => ({ text: q, type: 'question' as const, index: i })),
      ...goal.guidance_needed.map((g, i) => ({ text: g, type: 'guidance' as const, index: i })),
    ]

    const toResearch = allTopics.filter(t =>
      !goal.topicReports?.some(r => r.topic === t.text && r.type === t.type)
    )

    if (toResearch.length === 0) return { researched: 0, total: allTopics.length }

    const usingCli = !!findClaudeCli()
    console.log(`Researching ${toResearch.length} topics for "${goal.title}" (${usingCli ? 'CLI + API fallback' : 'API only'})`)

    const batchSize = 3
    let researched = 0

    for (let i = 0; i < toResearch.length; i += batchSize) {
      const batch = toResearch.slice(i, i + batchSize)

      const results = await Promise.allSettled(
        batch.map(t => researchTopicSmart(goal, t.text, t.type))
      )

      const freshGoal = getRoadmapGoals().find(g => g.id === goalId)
      if (!freshGoal) break

      const topicReports = [...(freshGoal.topicReports || [])]
      const now = new Date().toISOString()
      const modelInfo = getCurrentModelInfo('primary')
      const modelLabel = `${modelInfo.provider}/${modelInfo.model}`

      results.forEach((result, j) => {
        if (result.status === 'fulfilled') {
          const topic = batch[j]
          const idx = topicReports.findIndex(r => r.topic === topic.text && r.type === topic.type)
          const report = { topic: topic.text, type: topic.type, report: result.value, generatedAt: now, model: modelLabel }
          if (idx >= 0) topicReports[idx] = report
          else topicReports.push(report)
          researched++
          console.log(`  [${researched}/${toResearch.length}] Completed: ${topic.text.slice(0, 60)}...`)
        } else {
          console.error(`  Failed: ${batch[j].text.slice(0, 60)}... - ${result.reason}`)
        }
      })

      updateRoadmapGoal(goalId, { topicReports } as any)
    }

    const finalGoal = getRoadmapGoals().find(g => g.id === goalId)
    if (finalGoal) writeGoalContextFile(finalGoal)

    return { researched, total: allTopics.length }
  })

  // Research Single Topic
  ipcMain.handle('research-roadmap-topic', async (_, goalId: string, topicIndex: number, topicType: 'question' | 'guidance') => {
    const goals = getRoadmapGoals()
    const goal = goals.find(g => g.id === goalId)
    if (!goal) throw new Error('Goal not found')

    if (!isLLMConfigured()) throw new Error('No AI provider configured. Set it in Settings.')

    const items = topicType === 'question' ? goal.research_questions : goal.guidance_needed
    if (topicIndex < 0 || topicIndex >= items.length) throw new Error('Topic index out of range')

    const topicText = items[topicIndex]
    const report = await researchTopicSmart(goal, topicText, topicType)

    const generatedAt = new Date().toISOString()
    const modelInfo = getCurrentModelInfo('primary')
    const modelLabel = `${modelInfo.provider}/${modelInfo.model}`
    const topicReports = [...(goal.topicReports || [])]
    const existingIdx = topicReports.findIndex(r => r.topic === topicText && r.type === topicType)
    const newReport = { topic: topicText, type: topicType, report, generatedAt, model: modelLabel }
    if (existingIdx >= 0) topicReports[existingIdx] = newReport
    else topicReports.push(newReport)
    updateRoadmapGoal(goalId, { topicReports } as any)

    const freshGoal = getRoadmapGoals().find(g => g.id === goalId)
    if (freshGoal) writeGoalContextFile(freshGoal)

    return { report, generatedAt, model: modelLabel }
  })

  // Generate Action Plan
  ipcMain.handle('generate-action-plan', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find(g => g.id === goalId)
    if (!goal) throw new Error('Goal not found')

    if (!isLLMConfigured()) throw new Error('No AI provider configured. Set it in Settings.')

    const result = await generateActionPlan(goal)

    const generatedAt = new Date().toISOString()
    const modelInfo = getCurrentModelInfo('primary')
    const modelLabel = `${modelInfo.provider}/${modelInfo.model}`
    const topicReports = [...(goal.topicReports || [])]
    const existingIdx = topicReports.findIndex(r => (r as any).type === 'action_plan')
    const planReport = { topic: 'Action Plan', type: 'action_plan' as any, report: result.report, generatedAt, model: modelLabel }
    if (existingIdx >= 0) {
      topicReports[existingIdx] = planReport
    } else {
      topicReports.push(planReport)
    }
    updateRoadmapGoal(goalId, { topicReports } as any)

    const freshGoal = getRoadmapGoals().find(g => g.id === goalId)
    if (freshGoal) writeGoalContextFile(freshGoal)

    return { report: result.report, generatedAt }
  })

  // Master Plan
  ipcMain.handle('get-master-plan', () => {
    return getMasterPlan()
  })

  ipcMain.handle('generate-master-plan', async () => {
    const goals = getRoadmapGoals()
    const goalsWithResearch = goals.filter(g => (g.topicReports || []).length > 0)
    if (goalsWithResearch.length === 0) throw new Error('No goals with research reports. Research at least one goal first.')

    if (!isLLMConfigured()) throw new Error('No AI provider configured. Set it in Settings.')

    const content = await generateMasterPlan(goalsWithResearch)

    const planDate = new Date().toISOString().split('T')[0]
    const planModelInfo = getCurrentModelInfo('primary')
    const plan = {
      content,
      generatedAt: new Date().toISOString(),
      goalIds: goalsWithResearch.map(g => g.id),
      model: `${planModelInfo.provider}/${planModelInfo.model}`,
      metadata: {
        totalGoals: goals.length,
        goalsWithResearch: goalsWithResearch.length,
      }
    }
    const saved = saveMasterPlan(plan)

    try { saveMasterPlanFile(content, planDate) } catch {}

    try {
      clearMasterPlanTasks(planDate)
      const extracted = await extractTasksFromPlan(content, goalsWithResearch)
      for (const t of extracted) {
        createMasterPlanTask({
          title: t.title,
          description: t.description,
          priority: t.priority,
          goalId: t.goalId,
          goalTitle: t.goalTitle,
          phase: t.phase,
          status: 'pending',
          planDate,
        })
      }
    } catch (err) {
      console.error('Failed to extract tasks from plan:', err)
    }

    return saved
  })

  ipcMain.handle('clear-master-plan', () => {
    return clearMasterPlan()
  })

  // Master Plan Execution
  ipcMain.handle('generate-context-questions', async () => {
    const goals = getRoadmapGoals()
    const goalsWithResearch = goals.filter(g => (g.topicReports || []).length > 0)
    if (goalsWithResearch.length === 0) throw new Error('No goals with research reports.')

    if (!isLLMConfigured()) throw new Error('No AI provider configured.')

    return generateContextQuestions(goalsWithResearch)
  })

  ipcMain.handle('get-master-plan-tasks', (_, planDate?: string) => {
    return getMasterPlanTasks(planDate)
  })

  ipcMain.handle('update-master-plan-task', (_, id: string, updates: any) => {
    return updateMasterPlanTask(id, updates)
  })

  ipcMain.handle('launch-daily-plan', async (_, taskIds?: string[]) => {
    const allTasks = getMasterPlanTasks()
    const tolaunch = taskIds
      ? allTasks.filter(t => taskIds.includes(t.id) && t.status === 'pending')
      : allTasks.filter(t => t.status === 'pending').slice(0, 10)

    const launched: string[] = []
    const workingDir = process.env.USERPROFILE || '.'
    const env = { ...process.env }
    delete env.CLAUDECODE

    const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
    fs.mkdirSync(tmpDir, { recursive: true })

    for (const task of tolaunch.slice(0, 10)) {
      const safePrompt = `[Master Plan Task] ${task.title}: ${task.description}`.replace(/%/g, '%%').replace(/"/g, "'")
      const batFile = path.join(tmpDir, `plan-${task.id}-${Date.now()}.bat`)
      fs.writeFileSync(batFile, [
        '@echo off',
        `cd /d "${workingDir}"`,
        `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools "Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)" -- "${safePrompt}"`,
      ].join('\r\n'))
      const child = spawn('cmd.exe', ['/c', 'start', `"${task.title.slice(0, 40)}"`, 'cmd', '/k', batFile], {
        detached: true,
        stdio: 'ignore',
        env,
      })
      child.unref()

      updateMasterPlanTask(task.id, { status: 'launched', launchedAt: new Date().toISOString() })
      launched.push(task.id)
    }

    return { launched: launched.length, taskIds: launched }
  })

  ipcMain.handle('poll-task-sessions', async () => {
    const tasks = getMasterPlanTasks()
    const needsMatch = tasks.filter(t => (t.status === 'launched' || t.status === 'running') && !t.sessionId)

    for (const task of needsMatch) {
      if (!task.launchedAt) continue
      const fragment = task.title.slice(0, 40)
      const sessionId = await findSessionByPromptFragment(fragment, task.launchedAt)
      if (sessionId) {
        updateMasterPlanTask(task.id, { sessionId, status: 'running' })
      }
    }

    return getMasterPlanTasks()
  })

  // Goal Action Plan Task Execution
  ipcMain.handle('extract-goal-action-tasks', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find(g => g.id === goalId)
    if (!goal) throw new Error('Goal not found')

    const actionPlan = (goal.topicReports || []).find(r => (r as any).type === 'action_plan')
    if (!actionPlan) throw new Error('No action plan found. Generate one first with "Get Best Steps".')

    if (!isLLMConfigured()) throw new Error('No AI provider configured. Set it in Settings.')

    const planDate = `goal-${goalId}`
    clearMasterPlanTasks(planDate)

    const extracted = await extractTasksFromActionPlan(actionPlan.report, goal)
    const created = []
    for (const t of extracted) {
      created.push(createMasterPlanTask({
        title: t.title,
        description: t.description,
        priority: t.priority,
        goalId: t.goalId,
        goalTitle: t.goalTitle,
        phase: t.phase,
        status: 'pending',
        planDate,
        ...(t.taskType ? { taskType: t.taskType as any } : {}),
      }))
    }
    return created
  })

  ipcMain.handle('launch-goal-tasks', async (_, goalId: string, taskIds?: string[]) => {
    const planDate = `goal-${goalId}`
    const allTasks = getMasterPlanTasks(planDate)
    const tolaunch = taskIds
      ? allTasks.filter(t => taskIds.includes(t.id) && t.status === 'pending')
      : allTasks.filter(t => t.status === 'pending').slice(0, 10)

    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    const goalDir = goal ? getGoalDir(goal) : path.join(getMemoryDir(), 'goals', `goal-${goalId}`)
    const deliverablesDir = path.join(goalDir, 'deliverables')
    const workspaceFile = path.join(goalDir, '_workspace.md')

    fs.mkdirSync(deliverablesDir, { recursive: true })
    const agentResultsDir = path.join(goalDir, 'agent-results')
    fs.mkdirSync(agentResultsDir, { recursive: true })

    const repoDir = path.join(goalDir, 'repo')
    fs.mkdirSync(repoDir, { recursive: true })
    const gitDir = path.join(repoDir, '.git')
    if (!fs.existsSync(gitDir)) {
      try {
        execSync('git init', { cwd: repoDir, stdio: 'pipe' })
        execSync('git config user.email "mega-agenda@local"', { cwd: repoDir, stdio: 'pipe' })
        execSync('git config user.name "Mega Agenda"', { cwd: repoDir, stdio: 'pipe' })
        execSync(`git commit --allow-empty -m "init: ${(goal?.title || goalId).replace(/"/g, "'")}"`, { cwd: repoDir, stdio: 'pipe' })
      } catch (err) {
        console.error('Git init failed:', err)
      }
    }

    const actionPlan = goal ? (goal.topicReports || []).find((r: any) => r.type === 'action_plan') : null
    const actionPlanSummary = actionPlan ? actionPlan.report.slice(0, 2000) : '(No action plan available)'
    const taskTable = tolaunch.map((t, i) =>
      `| ${i + 1} | ${t.title} | ${t.priority} |`
    ).join('\n')

    const workspaceContent = [
      `# Workspace: ${goal?.title || goalId}`,
      goal?.description ? `> ${goal.description}` : '',
      '',
      `**Category:** ${goal?.category || 'N/A'} | **Priority:** ${goal?.priority || 'N/A'}`,
      '',
      '## Action Plan Summary',
      actionPlanSummary,
      '',
      '## Task Assignments',
      '| # | Task | Priority |',
      '|---|------|----------|',
      taskTable,
      '',
      '## Deliverables Directory',
      `Save files to: ${deliverablesDir}`,
      '',
      '## Agent Results Directory',
      `Each agent writes its own result file to: ${agentResultsDir}`,
      '',
    ].join('\n')

    fs.writeFileSync(workspaceFile, workspaceContent, 'utf-8')

    const launched: string[] = []
    const env = { ...process.env }
    delete env.CLAUDECODE

    const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
    fs.mkdirSync(tmpDir, { recursive: true })

    for (const task of tolaunch.slice(0, 10)) {
      const taskSlug = slugify(task.title).slice(0, 50)
      const agentResultFile = path.join(agentResultsDir, `${taskSlug}.md`)
      const agentConfig = getAgentConfig((task as any).taskType)
      const promptLines = [
        agentConfig.preamble,
        '',
        `[Goal Task: ${task.goalTitle}]`,
        '',
        `YOUR TASK: ${task.title}`,
        task.description,
        '',
        'BEFORE YOU START:',
        `1. Run "git log --oneline -10" to see what previous agents have already committed`,
        `2. Run "ls" or "dir" to see what files already exist in the repo`,
        '3. Read any existing files relevant to your task so you BUILD ON prior work, not duplicate it',
        '',
        'WORKSPACE COORDINATION:',
        `4. Read the shared workspace for context: ${workspaceFile}`,
        `5. Check other agents' results in: ${agentResultsDir}`,
        `6. Save files you create to: ${deliverablesDir}`,
        `7. When done, write your result summary to: ${agentResultFile}`,
        '   Use this format:',
        `   # Task: ${task.title}`,
        '   **Status:** completed',
        '   **Files created:** (list each file path)',
        '   **Summary:** (what you accomplished)',
        '8. Create real, usable files - code, templates, scripts, plans',
        '',
        'GIT WORKFLOW:',
        `Your working directory is a git repo at: ${repoDir}`,
        'Commit your work with a descriptive commit message when done.',
        `Use: git add -A && git commit -m "your message"`,
      ].join('\n')
      const safePrompt = promptLines.replace(/%/g, '%%').replace(/"/g, "'")
      const batFile = path.join(tmpDir, `goal-${task.id}-${Date.now()}.bat`)
      fs.writeFileSync(batFile, [
        '@echo off',
        `cd /d "${repoDir}"`,
        `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools ${agentConfig.allowedTools} -- "${safePrompt}"`,
      ].join('\r\n'))
      const child = spawn('cmd.exe', ['/c', 'start', '""', 'cmd', '/k', batFile], {
        detached: true,
        stdio: 'ignore',
        env,
      })
      child.unref()

      updateMasterPlanTask(task.id, { status: 'launched', launchedAt: new Date().toISOString() })
      launched.push(task.id)
    }

    return { launched: launched.length, taskIds: launched }
  })

  ipcMain.handle('poll-goal-task-sessions', async (_, goalId: string) => {
    const planDate = `goal-${goalId}`
    const tasks = getMasterPlanTasks(planDate)
    const needsMatch = tasks.filter(t => (t.status === 'launched' || t.status === 'running') && !t.sessionId)

    for (const task of needsMatch) {
      if (!task.launchedAt) continue
      const fragment = task.title.slice(0, 40)
      const sessionId = await findSessionByPromptFragment(fragment, task.launchedAt)
      if (sessionId) {
        updateMasterPlanTask(task.id, { sessionId, status: 'running' })
      }
    }

    // Auto-completion detection
    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    if (goal) {
      const agentResultsDir = path.join(getGoalDir(goal), 'agent-results')
      const activeTasks = getMasterPlanTasks(planDate).filter(t => t.status === 'launched' || t.status === 'running')
      for (const task of activeTasks) {
        const taskSlug = slugify(task.title).slice(0, 50)
        const resultFile = path.join(agentResultsDir, `${taskSlug}.md`)
        try {
          if (fs.existsSync(resultFile)) {
            const content = fs.readFileSync(resultFile, 'utf-8')
            if (content.includes('**Status:** completed')) {
              updateMasterPlanTask(task.id, { status: 'completed', completedAt: new Date().toISOString() })
            }
          }
        } catch {}
      }
    }

    return getMasterPlanTasks(planDate)
  })

  // Goal git log
  ipcMain.handle('get-goal-git-log', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    if (!goal) return []
    const repoDir = path.join(getGoalDir(goal), 'repo')
    if (!fs.existsSync(path.join(repoDir, '.git'))) return []
    try {
      const log = execSync('git log --oneline -20 --format="%h|%s|%ai|%an"', { cwd: repoDir, encoding: 'utf-8' })
      return log.trim().split('\n').filter(Boolean).map(line => {
        const [hash, message, date, author] = line.split('|')
        return { hash, message, date, author }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle('get-goal-repo-info', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    if (!goal) return null
    const repoDir = path.join(getGoalDir(goal), 'repo')
    if (!fs.existsSync(path.join(repoDir, '.git'))) return null
    try {
      let commitCount = 0
      try {
        const countOut = execSync('git rev-list --count HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim()
        commitCount = parseInt(countOut, 10) || 0
      } catch {}
      let fileCount = 0
      try {
        const filesOut = execSync('git ls-files', { cwd: repoDir, encoding: 'utf-8' }).trim()
        fileCount = filesOut ? filesOut.split('\n').length : 0
      } catch {}
      let sizeBytes = 0
      try {
        const entries = fs.readdirSync(repoDir, { withFileTypes: true })
        for (const e of entries) {
          if (e.isFile()) {
            sizeBytes += fs.statSync(path.join(repoDir, e.name)).size
          }
        }
      } catch {}
      return { path: repoDir, commitCount, fileCount, sizeBytes }
    } catch {
      return null
    }
  })

  ipcMain.handle('get-goal-workspace', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    if (!goal) return null
    const goalDir = getGoalDir(goal)
    const workspaceFile = path.join(goalDir, '_workspace.md')
    try {
      let content = fs.readFileSync(workspaceFile, 'utf-8')
      const agentResultsDir = path.join(goalDir, 'agent-results')
      try {
        const resultFiles = fs.readdirSync(agentResultsDir).filter(f => f.endsWith('.md'))
        if (resultFiles.length > 0) {
          content += '\n## Agent Results\n\n'
          for (const rf of resultFiles) {
            content += fs.readFileSync(path.join(agentResultsDir, rf), 'utf-8') + '\n\n---\n\n'
          }
        }
      } catch {}
      return content
    } catch {
      return null
    }
  })

  ipcMain.handle('get-goal-deliverables', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    if (!goal) return []
    const deliverablesDir = path.join(getGoalDir(goal), 'deliverables')
    try {
      const entries = fs.readdirSync(deliverablesDir, { withFileTypes: true })
      return entries.filter(e => e.isFile()).map(e => {
        const stat = fs.statSync(path.join(deliverablesDir, e.name))
        return { name: e.name, size: stat.size, modifiedAt: stat.mtime.toISOString() }
      })
    } catch {
      return []
    }
  })

  // Extract learnings from goal agent results
  ipcMain.handle('extract-goal-learnings', async (_, goalId: string) => {
    const goals = getRoadmapGoals()
    const goal = goals.find((g: any) => g.id === goalId)
    if (!goal) throw new Error('Goal not found')
    const goalDir = getGoalDir(goal)
    const agentResultsDir = path.join(goalDir, 'agent-results')

    let combinedContent = ''
    try {
      const resultFiles = fs.readdirSync(agentResultsDir).filter(f => f.endsWith('.md'))
      for (const rf of resultFiles) {
        combinedContent += fs.readFileSync(path.join(agentResultsDir, rf), 'utf-8') + '\n\n'
      }
    } catch {}

    const deliverablesDir = path.join(goalDir, 'deliverables')
    try {
      const delivFiles = fs.readdirSync(deliverablesDir)
      if (delivFiles.length > 0) {
        combinedContent += '\nDeliverables created: ' + delivFiles.join(', ') + '\n'
      }
    } catch {}

    if (!combinedContent.trim()) throw new Error('No agent results found to extract learnings from')

    const memories = await extractMemoriesFromAgentResult(
      combinedContent,
      goalId,
      goal.title,
      [goal.category, ...(goal.tags || [])]
    )

    if (memories.length > 0) {
      const lessonsFile = path.join(goalDir, '_lessons-learned.md')
      const newEntries = memories.map(m =>
        `### ${m.title}\n${m.content}\n*Topics: ${m.topics.join(', ')}*\n`
      ).join('\n')
      const header = `\n## Learnings — ${new Date().toISOString().split('T')[0]}\n\n`
      const existing = fs.existsSync(lessonsFile) ? fs.readFileSync(lessonsFile, 'utf-8') : '# Lessons Learned\n'
      fs.writeFileSync(lessonsFile, existing + header + newEntries, 'utf-8')
    }

    return { memoriesCreated: memories.length, memories }
  })

  // Smart Query
  ipcMain.handle('smart-query', async (_, query: string) => {
    if (!mainWindow) throw new Error('No main window')
    const queryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    streamSmartQuery(mainWindow, queryId, query)
    return { queryId }
  })
}
