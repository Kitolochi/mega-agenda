import { useState, useEffect, useCallback } from 'react'
import { MasterPlanTask } from '../../types'

interface ExecutionDashboardProps {
  planDate: string
  onViewSession: (sessionId: string) => void
}

const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

const priorityStyles: Record<string, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500', label: 'text-red-400' },
  high: { dot: 'bg-orange-500', label: 'text-orange-400' },
  medium: { dot: 'bg-yellow-500', label: 'text-yellow-400' },
  low: { dot: 'bg-blue-500', label: 'text-blue-400' },
}

const statusStyles: Record<string, { bg: string; text: string; animate?: string }> = {
  pending: { bg: 'bg-white/5', text: 'text-muted' },
  launched: { bg: 'bg-amber-500/10', text: 'text-amber-400', animate: 'animate-pulse' },
  running: { bg: 'bg-purple-500/10', text: 'text-purple-400', animate: 'animate-pulse' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-400' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

function ElapsedTime({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(since).getTime()
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      if (mins > 0) setElapsed(`${mins}m ${secs}s`)
      else setElapsed(`${secs}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [since])

  return <span className="text-muted text-[10px] tabular-nums">{elapsed}</span>
}

export default function ExecutionDashboard({ planDate, onViewSession }: ExecutionDashboardProps) {
  const [tasks, setTasks] = useState<MasterPlanTask[]>([])
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadTasks = useCallback(async () => {
    try {
      const result = await window.electronAPI.getMasterPlanTasks(planDate)
      setTasks(result)
    } catch {}
    setLoading(false)
  }, [planDate])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Auto-refresh polling every 10 seconds
  useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'launched' || t.status === 'running')
    if (!hasActive) return

    const interval = setInterval(async () => {
      try {
        const updated = await window.electronAPI.pollTaskSessions()
        // Only keep tasks for this planDate
        setTasks(updated.filter(t => t.planDate === planDate))
      } catch {}
    }, 10000)

    return () => clearInterval(interval)
  }, [tasks, planDate])

  const handleLaunch = async () => {
    setLaunching(true)
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined
      await window.electronAPI.launchDailyPlan(ids)
      setSelected(new Set())
      await loadTasks()
    } catch {}
    setLaunching(false)
  }

  const handleMarkStatus = async (id: string, status: 'completed' | 'failed') => {
    await window.electronAPI.updateMasterPlanTask(id, { status, completedAt: new Date().toISOString() })
    await loadTasks()
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const pendingIds = tasks.filter(t => t.status === 'pending').map(t => t.id)
    setSelected(prev => prev.size === pendingIds.length ? new Set() : new Set(pendingIds))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mb-3" />
        <p className="text-muted text-xs">Loading tasks...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        </div>
        <p className="text-white text-sm font-medium mb-1">No tasks extracted yet</p>
        <p className="text-muted text-xs max-w-xs">Generate a master plan first. Tasks will be automatically extracted from the plan.</p>
      </div>
    )
  }

  const pending = tasks.filter(t => t.status === 'pending').length
  const active = tasks.filter(t => t.status === 'launched' || t.status === 'running').length
  const completed = tasks.filter(t => t.status === 'completed').length
  const failed = tasks.filter(t => t.status === 'failed').length

  // Group tasks by priority
  const grouped = ['critical', 'high', 'medium', 'low']
    .map(p => ({ priority: p, tasks: tasks.filter(t => t.priority === p) }))
    .filter(g => g.tasks.length > 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted">{tasks.length} tasks</span>
          {pending > 0 && <span className="text-white/50">{pending} pending</span>}
          {active > 0 && <span className="text-purple-400">{active} active</span>}
          {completed > 0 && <span className="text-green-400">{completed} done</span>}
          {failed > 0 && <span className="text-red-400">{failed} failed</span>}
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <>
              <button
                onClick={selectAll}
                className="px-2 py-1 rounded text-[10px] text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                {selected.size === tasks.filter(t => t.status === 'pending').length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-all disabled:opacity-50"
              >
                {launching ? (
                  <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                  </svg>
                )}
                Run {selected.size > 0 ? `${selected.size} Selected` : 'Daily Plan'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Task groups */}
      <div className="space-y-4">
        {grouped.map(group => (
          <div key={group.priority}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${priorityStyles[group.priority]?.dot}`} />
              <span className={`text-xs font-medium capitalize ${priorityStyles[group.priority]?.label}`}>
                {group.priority}
              </span>
              <span className="text-muted text-[10px]">({group.tasks.length})</span>
            </div>

            <div className="space-y-1.5">
              {group.tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).map(task => {
                const style = statusStyles[task.status] || statusStyles.pending
                return (
                  <div
                    key={task.id}
                    className={`rounded-lg border border-border p-3 ${style.bg} ${style.animate || ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {task.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selected.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          className="mt-0.5 rounded border-border accent-amber-500"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white text-xs font-medium truncate">{task.title}</span>
                          <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${style.text} bg-white/5`}>
                            {task.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted">
                          <span>{task.goalTitle}</span>
                          {task.phase && (
                            <>
                              <span className="text-white/10">|</span>
                              <span>{task.phase}</span>
                            </>
                          )}
                          {task.launchedAt && (task.status === 'launched' || task.status === 'running') && (
                            <>
                              <span className="text-white/10">|</span>
                              <ElapsedTime since={task.launchedAt} />
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {task.sessionId && (
                          <button
                            onClick={() => onViewSession(task.sessionId!)}
                            className="px-1.5 py-0.5 rounded text-[10px] text-purple-400 hover:bg-purple-500/10 transition-colors"
                            title="View CLI session"
                          >
                            Session
                          </button>
                        )}
                        {(task.status === 'launched' || task.status === 'running') && (
                          <>
                            <button
                              onClick={() => handleMarkStatus(task.id, 'completed')}
                              className="px-1.5 py-0.5 rounded text-[10px] text-green-400 hover:bg-green-500/10 transition-colors"
                            >
                              Done
                            </button>
                            <button
                              onClick={() => handleMarkStatus(task.id, 'failed')}
                              className="px-1.5 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Failed
                            </button>
                          </>
                        )}
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleMarkStatus(task.id, 'completed')}
                            className="px-1.5 py-0.5 rounded text-[10px] text-muted hover:text-green-400 hover:bg-green-500/10 transition-colors"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
