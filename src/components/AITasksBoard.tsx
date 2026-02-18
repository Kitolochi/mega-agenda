import { useState, useEffect, useCallback } from 'react'
import { AITask, GitHubRepoResult } from '../types'
import TaskLaunchPanel from './TaskLaunchPanel'

type Column = AITask['column']
type Priority = AITask['priority']

/** Escape a string for safe use inside double quotes in cmd.exe */
function escapeForCmd(text: string): string {
  return text.replace(/"/g, "'").replace(/%/g, '%%').replace(/\r?\n/g, ' ')
}

/** Build a structured single-line prompt from task + optional context */
function buildRichPrompt(
  task: AITask,
  context: { cliSessionId?: string; repoFullName?: string }
): string {
  const desc = task.description.length > 500
    ? task.description.slice(0, 500) + '...'
    : task.description
  const parts: string[] = [
    `TASK: ${task.title}`,
  ]
  if (desc) parts.push(`DESCRIPTION: ${desc}`)
  parts.push(`PRIORITY: ${task.priority}`)
  if (task.tags.length > 0) parts.push(`TAGS: ${task.tags.join(', ')}`)
  if (context.repoFullName) parts.push(`RELEVANT REPO: ${context.repoFullName}`)
  if (context.cliSessionId) parts.push(`PREVIOUS SESSION: ${context.cliSessionId}`)
  parts.push('Please work on this task autonomously. Read the relevant codebase, implement the changes, and verify your work.')
  return parts.join(' | ')
}

/** Quick parallel search for CLI sessions + GitHub repos with a hard timeout */
async function quickSearch(task: AITask, timeoutMs = 2000): Promise<{
  cliSessionId?: string
  repoFullName?: string
  localPath?: string
}> {
  const searchPromise = (async () => {
    const queries = [task.title]
    if (task.tags.length > 0) queries.push(task.tags.join(' '))

    const [cliResults, githubResults] = await Promise.allSettled([
      // Search CLI sessions with first query
      window.electronAPI.searchCliSessions(queries[0]),
      // Search GitHub repos
      window.electronAPI.searchGitHubRepos(task.title),
    ])

    const result: { cliSessionId?: string; repoFullName?: string; localPath?: string } = {}

    if (cliResults.status === 'fulfilled' && cliResults.value.length > 0) {
      result.cliSessionId = cliResults.value[0].sessionId
    }

    if (githubResults.status === 'fulfilled' && githubResults.value.length > 0) {
      // Prefer repos with local clones
      const withLocal = githubResults.value.find((r: GitHubRepoResult) => r.localPath)
      const best = withLocal || githubResults.value[0]
      result.repoFullName = best.fullName
      if (best.localPath) result.localPath = best.localPath
    }

    return result
  })()

  const timeout = new Promise<{ cliSessionId?: string; repoFullName?: string; localPath?: string }>(
    resolve => setTimeout(() => resolve({}), timeoutMs)
  )

  return Promise.race([searchPromise, timeout])
}

const COLUMNS: { key: Column; label: string; color: string; bgClass: string }[] = [
  { key: 'backlog', label: 'Backlog', color: '#6C8EEF', bgClass: 'bg-accent-blue/10' },
  { key: 'todo', label: 'Todo', color: '#FBBF24', bgClass: 'bg-accent-amber/10' },
  { key: 'in_progress', label: 'In Progress', color: '#A78BFA', bgClass: 'bg-accent-purple/10' },
  { key: 'done', label: 'Done', color: '#34D399', bgClass: 'bg-accent-emerald/10' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-accent-red',
  medium: 'bg-accent-amber',
  low: 'bg-accent-blue',
}

const COLUMN_ORDER: Column[] = ['backlog', 'todo', 'in_progress', 'done']

function getPrevColumn(col: Column): Column | null {
  const idx = COLUMN_ORDER.indexOf(col)
  return idx > 0 ? COLUMN_ORDER[idx - 1] : null
}

function getNextColumn(col: Column): Column | null {
  const idx = COLUMN_ORDER.indexOf(col)
  return idx < COLUMN_ORDER.length - 1 ? COLUMN_ORDER[idx + 1] : null
}

interface AITasksBoardProps {
  onTerminalCommand?: (command: string) => void
}

export default function AITasksBoard({ onTerminalCommand }: AITasksBoardProps) {
  const [tasks, setTasks] = useState<AITask[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [launchingTask, setLaunchingTask] = useState<AITask | null>(null)
  const [launchingTaskId, setLaunchingTaskId] = useState<string | null>(null)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newTags, setNewTags] = useState('')

  // Edit state
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('medium')
  const [editTags, setEditTags] = useState('')

  const loadTasks = useCallback(async () => {
    const data = await window.electronAPI.getAITasks()
    setTasks(data)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const handleAutoLaunch = useCallback(async (task: AITask) => {
    setLaunchingTaskId(task.id)
    try {
      const context = await quickSearch(task)
      const prompt = escapeForCmd(buildRichPrompt(task, context))
      const cwd = context.localPath || undefined
      await window.electronAPI.launchExternalTerminal(prompt, cwd)
      await window.electronAPI.moveAITask(task.id, 'in_progress')
      await loadTasks()
    } finally {
      setLaunchingTaskId(null)
    }
  }, [loadTasks])

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    const tags = newTags.split(',').map(t => t.trim()).filter(Boolean)
    await window.electronAPI.createAITask({
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      tags,
    })
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setNewTags('')
    setShowAddForm(false)
    await loadTasks()
  }

  const handleMove = async (id: string, column: Column) => {
    await window.electronAPI.moveAITask(id, column)
    await loadTasks()
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteAITask(id)
    setDeleteConfirmId(null)
    setExpandedId(null)
    await loadTasks()
  }

  const handleExpand = (task: AITask) => {
    if (expandedId === task.id) {
      setExpandedId(null)
    } else {
      setExpandedId(task.id)
      setEditTitle(task.title)
      setEditDesc(task.description)
      setEditPriority(task.priority)
      setEditTags(task.tags.join(', '))
    }
  }

  const handleSaveEdit = async (id: string) => {
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    await window.electronAPI.updateAITask(id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      priority: editPriority,
      tags,
    })
    setExpandedId(null)
    await loadTasks()
  }

  const tasksByColumn = (col: Column) => tasks.filter(t => t.column === col)

  if (tasks.length === 0 && !showAddForm) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-fade-in px-6">
        <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-accent-purple/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <p className="text-white/70 text-sm font-medium mb-1">No AI tasks yet</p>
        <p className="text-muted text-xs mb-4">Track your AI project ideas and tasks</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 rounded-lg bg-accent-purple/20 text-accent-purple text-xs font-medium hover:bg-accent-purple/30 transition-all"
        >
          Add your first AI task
        </button>
      </div>
    )
  }

  const handleLaunchExecute = (command: string) => {
    if (onTerminalCommand) onTerminalCommand(command)
    setLaunchingTask(null)
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Launch panel */}
      {launchingTask && (
        <TaskLaunchPanel
          task={launchingTask}
          onClose={() => setLaunchingTask(null)}
          onExecute={handleLaunchExecute}
        />
      )}

      {/* Kanban grid */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-2 p-3 h-full min-w-[720px]">
          {COLUMNS.map(col => {
            const colTasks = tasksByColumn(col.key)
            return (
              <div key={col.key} className="flex-1 flex flex-col min-w-0">
                {/* Column header */}
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">{col.label}</span>
                  <span className="text-[10px] text-muted bg-surface-3 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 pb-2">
                  {colTasks.map(task => (
                    <div key={task.id}>
                      {/* Card */}
                      <div
                        onClick={() => handleExpand(task)}
                        className={`group rounded-lg border transition-all cursor-pointer ${
                          expandedId === task.id
                            ? 'bg-surface-3 border-white/10'
                            : 'bg-surface-2/80 border-white/[0.04] hover:border-white/[0.08] hover:bg-surface-2'
                        }`}
                      >
                        <div className="p-2.5">
                          {/* Title row */}
                          <div className="flex items-start gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
                            <p className="text-[11px] font-medium text-white/90 leading-snug flex-1 break-words">
                              {task.title}
                            </p>
                          </div>

                          {/* Description (truncated) */}
                          {task.description && expandedId !== task.id && (
                            <p className="text-[10px] text-muted mt-1 ml-3 line-clamp-2">{task.description}</p>
                          )}

                          {/* Tags */}
                          {task.tags.length > 0 && expandedId !== task.id && (
                            <div className="flex flex-wrap gap-1 mt-1.5 ml-3">
                              {task.tags.map(tag => (
                                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-4 text-muted">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Move arrows + Launch (visible on hover when not expanded) */}
                          {expandedId !== task.id && (
                            <div className="flex justify-end gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {task.column !== 'done' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (e.shiftKey) {
                                      setLaunchingTask(task)
                                    } else {
                                      handleAutoLaunch(task)
                                    }
                                  }}
                                  disabled={launchingTaskId === task.id}
                                  className="w-5 h-5 rounded bg-accent-amber/20 hover:bg-accent-amber/30 flex items-center justify-center text-accent-amber transition-all disabled:opacity-50"
                                  title="Launch task (Shift+click for manual mode)"
                                >
                                  {launchingTaskId === task.id ? (
                                    <div className="w-2.5 h-2.5 border-2 border-accent-amber/40 border-t-accent-amber rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                  )}
                                </button>
                              )}
                              {getPrevColumn(task.column) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMove(task.id, getPrevColumn(task.column)!) }}
                                  className="w-5 h-5 rounded bg-surface-4 hover:bg-surface-3 flex items-center justify-center text-muted hover:text-white/70 transition-all"
                                  title={`Move to ${COLUMNS.find(c => c.key === getPrevColumn(task.column))?.label}`}
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                  </svg>
                                </button>
                              )}
                              {getNextColumn(task.column) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMove(task.id, getNextColumn(task.column)!) }}
                                  className="w-5 h-5 rounded bg-surface-4 hover:bg-surface-3 flex items-center justify-center text-muted hover:text-white/70 transition-all"
                                  title={`Move to ${COLUMNS.find(c => c.key === getNextColumn(task.column))?.label}`}
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expanded edit form */}
                        {expandedId === task.id && (
                          <div className="px-2.5 pb-2.5 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full bg-surface-4 text-white text-[11px] rounded-md px-2 py-1.5 border border-white/[0.06] focus:border-accent-purple/40 outline-none"
                              placeholder="Title"
                            />
                            <textarea
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full bg-surface-4 text-white text-[10px] rounded-md px-2 py-1.5 border border-white/[0.06] focus:border-accent-purple/40 outline-none resize-none"
                              rows={2}
                              placeholder="Description"
                            />
                            <div className="flex gap-1.5">
                              {(['high', 'medium', 'low'] as Priority[]).map(p => (
                                <button
                                  key={p}
                                  onClick={() => setEditPriority(p)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${
                                    editPriority === p
                                      ? 'bg-surface-4 text-white border border-white/10'
                                      : 'text-muted hover:text-white/60'
                                  }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[p]}`} />
                                  {p}
                                </button>
                              ))}
                            </div>
                            <input
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              className="w-full bg-surface-4 text-white text-[10px] rounded-md px-2 py-1.5 border border-white/[0.06] focus:border-accent-purple/40 outline-none"
                              placeholder="Tags (comma separated)"
                            />
                            {/* Move buttons */}
                            <div className="flex gap-1">
                              {getPrevColumn(task.column) && (
                                <button
                                  onClick={() => handleMove(task.id, getPrevColumn(task.column)!)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted hover:text-white/70 bg-surface-4 hover:bg-surface-3 transition-all"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                  </svg>
                                  {COLUMNS.find(c => c.key === getPrevColumn(task.column))?.label}
                                </button>
                              )}
                              {getNextColumn(task.column) && (
                                <button
                                  onClick={() => handleMove(task.id, getNextColumn(task.column)!)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted hover:text-white/70 bg-surface-4 hover:bg-surface-3 transition-all"
                                >
                                  {COLUMNS.find(c => c.key === getNextColumn(task.column))?.label}
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            {/* Launch button */}
                            {task.column !== 'done' && (
                              <button
                                onClick={(e) => {
                                  if (e.shiftKey) {
                                    setLaunchingTask(task)
                                  } else {
                                    handleAutoLaunch(task)
                                  }
                                }}
                                disabled={launchingTaskId === task.id}
                                className="w-full py-1.5 rounded-md bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25 text-[10px] font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                title="Launch task (Shift+click for manual mode)"
                              >
                                {launchingTaskId === task.id ? (
                                  <div className="w-3 h-3 border-2 border-accent-amber/40 border-t-accent-amber rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                )}
                                {launchingTaskId === task.id ? 'Launching...' : 'Launch'}
                              </button>
                            )}
                            {/* Actions */}
                            <div className="flex justify-between pt-1">
                              <button
                                onClick={() => {
                                  if (deleteConfirmId === task.id) {
                                    handleDelete(task.id)
                                  } else {
                                    setDeleteConfirmId(task.id)
                                  }
                                }}
                                className={`text-[10px] px-2 py-1 rounded-md transition-all ${
                                  deleteConfirmId === task.id
                                    ? 'bg-accent-red/20 text-accent-red'
                                    : 'text-muted hover:text-accent-red'
                                }`}
                              >
                                {deleteConfirmId === task.id ? 'Confirm delete?' : 'Delete'}
                              </button>
                              <button
                                onClick={() => handleSaveEdit(task.id)}
                                className="text-[10px] px-3 py-1 rounded-md bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 font-medium transition-all"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add button at bottom of backlog */}
                  {col.key === 'backlog' && (
                    <>
                      {showAddForm ? (
                        <div className="rounded-lg bg-surface-2 border border-white/[0.06] p-2.5 space-y-2">
                          <input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full bg-surface-4 text-white text-[11px] rounded-md px-2 py-1.5 border border-white/[0.06] focus:border-accent-purple/40 outline-none"
                            placeholder="Task title"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) handleAdd(); if (e.key === 'Escape') setShowAddForm(false) }}
                          />
                          <textarea
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            className="w-full bg-surface-4 text-white text-[10px] rounded-md px-2 py-1.5 border border-white/[0.06] focus:border-accent-purple/40 outline-none resize-none"
                            rows={2}
                            placeholder="Description (optional)"
                          />
                          <div className="flex gap-1.5">
                            {(['high', 'medium', 'low'] as Priority[]).map(p => (
                              <button
                                key={p}
                                onClick={() => setNewPriority(p)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${
                                  newPriority === p
                                    ? 'bg-surface-4 text-white border border-white/10'
                                    : 'text-muted hover:text-white/60'
                                }`}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[p]}`} />
                                {p}
                              </button>
                            ))}
                          </div>
                          <input
                            value={newTags}
                            onChange={(e) => setNewTags(e.target.value)}
                            className="w-full bg-surface-4 text-white text-[10px] rounded-md px-2 py-1.5 border border-white/[0.06] focus:border-accent-purple/40 outline-none"
                            placeholder="Tags (comma separated)"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => { setShowAddForm(false); setNewTitle(''); setNewDesc(''); setNewTags('') }}
                              className="text-[10px] px-2 py-1 rounded-md text-muted hover:text-white/60 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAdd}
                              disabled={!newTitle.trim()}
                              className="text-[10px] px-3 py-1 rounded-md bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddForm(true)}
                          className="w-full py-2 rounded-lg border border-dashed border-white/[0.06] text-muted hover:text-white/50 hover:border-white/[0.12] text-[10px] flex items-center justify-center gap-1 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Add task
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
