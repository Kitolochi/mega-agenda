import { useState, useEffect, useRef, useCallback } from 'react'
import { RoadmapGoal, ContextFile, MasterPlanTask, GitLogEntry, ResearchQueueProgress, GoalActivityEntry } from '../../types'
import { CATEGORIES, catColor } from './constants'
import GoalForm from './GoalForm'

function TopicRow({ text, type, index, report, isExpanded, isResearching, isStub, setExpandedTopic, handleResearchTopic, handleRemoveReport, topicKey }: {
  text: string; type: 'question' | 'guidance'; index: number;
  report: { report: string; generatedAt: string } | undefined;
  isExpanded: boolean; isResearching: boolean; isStub: boolean;
  setExpandedTopic: (k: string | null) => void;
  handleResearchTopic: (i: number, t: 'question' | 'guidance') => void;
  handleRemoveReport: (topic: string, type: string) => void;
  topicKey: string;
}) {
  return (
    <div className={`rounded-lg border bg-surface-2/40 overflow-hidden ${isStub ? 'border-accent-red/20' : 'border-white/[0.06]'}`}>
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-surface-2/60 transition-all"
        onClick={() => report ? setExpandedTopic(isExpanded ? null : topicKey) : null}
      >
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isStub ? 'bg-accent-red' : report ? 'bg-green-400' : 'bg-white/[0.15]'}`} />
        <span className="text-xs text-white/80 flex-1">{text}</span>
        {report && isStub && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-accent-red/15 text-accent-red flex-shrink-0">stub</span>
        )}
        {report && !isStub && (
          <span className="text-[8px] text-muted/40 flex-shrink-0">{(report.report.length / 1000).toFixed(1)}k</span>
        )}
        {!report && (
          <button
            onClick={(e) => { e.stopPropagation(); handleResearchTopic(index, type) }}
            disabled={isResearching}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-purple/15 text-accent-purple text-[9px] font-medium hover:bg-accent-purple/25 transition-all disabled:opacity-50"
          >
            {isResearching ? (
              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            Research
          </button>
        )}
        {report && (
          <svg className={`w-3.5 h-3.5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        )}
      </div>
      {isExpanded && report && (
        <div className="border-t border-white/[0.04] px-4 py-3 bg-surface-1/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-muted">
              {new Date(report.generatedAt).toLocaleDateString()} · {(report.report.length / 1000).toFixed(1)}k chars
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleResearchTopic(index, type)}
                disabled={isResearching}
                className="text-[9px] text-muted hover:text-accent-purple transition-colors"
              >Re-research</button>
              <button
                onClick={() => handleRemoveReport(text, type)}
                className="text-[9px] text-muted/40 hover:text-accent-red transition-colors"
              >Remove</button>
            </div>
          </div>
          <div className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed">{report.report}</div>
        </div>
      )}
    </div>
  )
}

interface GoalDetailViewProps {
  goal: RoadmapGoal
  onUpdateGoal: (updates: Partial<RoadmapGoal>) => Promise<void>
  onDeleteGoal: () => Promise<void>
  onReload: () => void
  onBack: () => void
}

export default function GoalDetailView({ goal, onUpdateGoal, onDeleteGoal, onReload, onBack }: GoalDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'research' | 'tasks'>('research')
  const [editing, setEditing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [researchingAll, setResearchingAll] = useState(false)
  const [researchingIdx, setResearchingIdx] = useState<string | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [findingTopics, setFindingTopics] = useState(false)
  const [showDirectionPrompt, setShowDirectionPrompt] = useState(false)
  const [topicDirection, setTopicDirection] = useState('')
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [categorizing, setCategorizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [showContextPicker, setShowContextPicker] = useState(false)

  // Task execution state
  const [tasks, setTasks] = useState<MasterPlanTask[]>([])
  const [extracting, setExtracting] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Workspace state
  const [workspace, setWorkspace] = useState<string | null>(null)
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false)
  const [deliverables, setDeliverables] = useState<{ name: string; size: number; modifiedAt: string }[]>([])
  const [gitLog, setGitLog] = useState<GitLogEntry[]>([])
  const [repoInfo, setRepoInfo] = useState<{ path: string; commitCount: number; fileCount: number; sizeBytes: number } | null>(null)
  const [repoExpanded, setRepoExpanded] = useState(false)
  const [extractingLearnings, setExtractingLearnings] = useState(false)
  const [learningsResult, setLearningsResult] = useState<{ count: number } | null>(null)

  // Orchestrator log state
  const [orchLines, setOrchLines] = useState<string[]>([])
  const [orchRunning, setOrchRunning] = useState(false)
  const [orchExpanded, setOrchExpanded] = useState(true)
  const orchLogRef = useRef<HTMLDivElement>(null)

  // Research queue state
  const [researchProgress, setResearchProgress] = useState<ResearchQueueProgress | null>(null)
  const researchStartRef = useRef<number>(0)
  const [researchElapsed, setResearchElapsed] = useState(0)

  // Activity feed state
  const [activityExpanded, setActivityExpanded] = useState(false)

  useEffect(() => {
    window.electronAPI.getContextFiles().then(setContextFiles).catch(() => {})
    // Load any existing tasks for this goal
    window.electronAPI.getMasterPlanTasks(`goal-${goal.id}`).then(setTasks).catch(() => {})
    // Load workspace and deliverables
    window.electronAPI.getGoalWorkspace(goal.id).then(setWorkspace).catch(() => {})
    window.electronAPI.getGoalDeliverables(goal.id).then(setDeliverables).catch(() => {})
    window.electronAPI.getGoalGitLog(goal.id).then(setGitLog).catch(() => {})
    window.electronAPI.getGoalRepoInfo(goal.id).then(setRepoInfo).catch(() => {})
  }, [goal.id])

  // Auto-poll when tasks are launched/running
  useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'launched' || t.status === 'running')
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await window.electronAPI.pollGoalTaskSessions(goal.id)
          setTasks(updated)
          // Refresh workspace and deliverables
          window.electronAPI.getGoalWorkspace(goal.id).then(setWorkspace).catch(() => {})
          window.electronAPI.getGoalDeliverables(goal.id).then(setDeliverables).catch(() => {})
          window.electronAPI.getGoalGitLog(goal.id).then(setGitLog).catch(() => {})
          window.electronAPI.getGoalRepoInfo(goal.id).then(setRepoInfo).catch(() => {})
        } catch {}
      }, 10000)
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [tasks, goal.id])

  // Subscribe to research progress events
  useEffect(() => {
    const unsub = window.electronAPI.onResearchProgress((data: ResearchQueueProgress) => {
      if (data.goalId !== goal.id) return
      setResearchProgress(data)
      if (data.status === 'completed' || data.status === 'cancelled') {
        setResearchingAll(false)
        onReload()
      }
    })
    return unsub
  }, [goal.id])

  // Subscribe to orchestrator output
  useEffect(() => {
    const orchId = `goal-${goal.id}`
    // Check initial running status
    window.electronAPI.isOrchestratorRunning(orchId).then(setOrchRunning).catch(() => {})

    const unsub = window.electronAPI.onOrchestratorOutput((data: { id: string; line: string }) => {
      if (data.id !== orchId) return
      setOrchRunning(true)
      setOrchLines(prev => {
        const next = [...prev, data.line]
        return next.length > 500 ? next.slice(-500) : next
      })
      // Auto-scroll
      requestAnimationFrame(() => {
        orchLogRef.current?.scrollTo({ top: orchLogRef.current.scrollHeight })
      })
      // Detect exit line
      if (data.line.startsWith('[orchestrator] Exited')) {
        setOrchRunning(false)
      }
    })
    return unsub
  }, [goal.id])

  const handleStopOrchestrator = useCallback(async () => {
    await window.electronAPI.stopOrchestrator(`goal-${goal.id}`)
    setOrchRunning(false)
    setOrchLines(prev => [...prev, '[orchestrator] Stopped by user'])
  }, [goal.id])

  // Elapsed timer for research
  useEffect(() => {
    if (!researchingAll) {
      setResearchElapsed(0)
      return
    }
    researchStartRef.current = Date.now()
    const timer = setInterval(() => {
      setResearchElapsed(Math.floor((Date.now() - researchStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [researchingAll])

  const handleExtractTasks = async () => {
    setExtracting(true)
    setError(null)
    try {
      const result = await window.electronAPI.extractGoalActionTasks(goal.id)
      setTasks(result)
      setSelectedTasks(new Set())
    } catch (err: any) {
      setError(err.message || 'Failed to extract tasks')
    } finally {
      setExtracting(false)
    }
  }

  const handleLaunchTasks = async (taskIds?: string[]) => {
    setLaunching(true)
    setError(null)
    try {
      await window.electronAPI.launchGoalTasks(goal.id, taskIds)
      const updated = await window.electronAPI.getMasterPlanTasks(`goal-${goal.id}`)
      setTasks(updated)
      setSelectedTasks(new Set())
    } catch (err: any) {
      setError(err.message || 'Failed to launch tasks')
    } finally {
      setLaunching(false)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, status: MasterPlanTask['status']) => {
    try {
      await window.electronAPI.updateMasterPlanTask(taskId, {
        status,
        ...(status === 'completed' || status === 'failed' ? { completedAt: new Date().toISOString() } : {})
      })
      const updated = await window.electronAPI.getMasterPlanTasks(`goal-${goal.id}`)
      setTasks(updated)
    } catch {}
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleExtractLearnings = async () => {
    setExtractingLearnings(true)
    setLearningsResult(null)
    try {
      const result = await window.electronAPI.extractGoalLearnings(goal.id)
      setLearningsResult({ count: result.memoriesCreated })
      setTimeout(() => setLearningsResult(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to extract learnings')
    } finally {
      setExtractingLearnings(false)
    }
  }

  const completedTasks = tasks.filter(t => t.status === 'completed')
  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const selectedPendingIds = [...selectedTasks].filter(id => pendingTasks.some(t => t.id === id))

  const isStubReport = (report: string): boolean => {
    if (report.length < 800) return true
    const stubPatterns = [
      /what would you like me to/i,
      /please provide a file path/i,
      /I can see you're working on/i,
      /what would you like me to help/i,
      /I don't have enough context/i,
      /could you provide more/i,
      /please share the file/i,
    ]
    return stubPatterns.some(p => p.test(report))
  }

  const handleRemoveReport = async (topic: string, topicType: string) => {
    try {
      await window.electronAPI.removeTopicReport(goal.id, topic, topicType)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Failed to remove report')
    }
  }

  const handlePurgeStubs = async () => {
    try {
      const result = await window.electronAPI.purgeStubReports(goal.id)
      if (result.removed > 0) onReload()
    } catch (err: any) {
      setError(err.message || 'Failed to purge stubs')
    }
  }

  const handleCategorizeTopics = async () => {
    setCategorizing(true)
    setError(null)
    try {
      await window.electronAPI.categorizeGoalTopics(goal.id)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Failed to categorize topics')
    } finally {
      setCategorizing(false)
    }
  }

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const activityDotColors: Record<string, string> = {
    topics_found: 'bg-accent-blue',
    topic_researched: 'bg-accent-purple',
    action_plan_generated: 'bg-accent-emerald',
    tasks_extracted: 'bg-accent-orange',
    tasks_launched: 'bg-green-400',
    task_completed: 'bg-cyan-400',
  }

  const color = catColor(goal.category)
  const allTopics = [
    ...goal.research_questions.map((q, i) => ({ text: q, type: 'question' as const, index: i })),
    ...goal.guidance_needed.map((g, i) => ({ text: g, type: 'guidance' as const, index: i })),
  ]
  const totalTopics = allTopics.length
  const researchedCount = goal.topicReports?.filter(r => (r.type as string) !== 'action_plan').length || 0
  const stubCount = (goal.topicReports || []).filter(r => (r.type as string) !== 'action_plan' && isStubReport(r.report)).length

  const hasReport = (text: string, type: 'question' | 'guidance') =>
    goal.topicReports?.find(r => r.topic === text && r.type === type)

  const handleResearchAll = async () => {
    setResearchingAll(true)
    setResearchProgress(null)
    setError(null)
    try {
      await window.electronAPI.researchRoadmapGoal(goal.id)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Research failed')
    } finally {
      setResearchingAll(false)
      setResearchProgress(null)
    }
  }

  const handleCancelResearch = async () => {
    try {
      await window.electronAPI.cancelResearch()
    } catch {}
    setResearchingAll(false)
    setResearchProgress(null)
  }

  const handleResearchTopic = async (topicIndex: number, topicType: 'question' | 'guidance') => {
    const key = `${topicType}-${topicIndex}`
    setResearchingIdx(key)
    setError(null)
    try {
      await window.electronAPI.researchRoadmapTopic(goal.id, topicIndex, topicType)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Research failed')
    } finally {
      setResearchingIdx(null)
    }
  }

  const handleFindTopicsClick = () => {
    setTopicDirection('')
    setShowDirectionPrompt(true)
  }

  const handleFindTopics = async (direction?: string) => {
    setShowDirectionPrompt(false)
    setFindingTopics(true)
    setError(null)
    try {
      const trimmed = direction?.trim() || undefined
      await window.electronAPI.generateTopics(goal.id, trimmed)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Failed to find topics')
    } finally {
      setFindingTopics(false)
    }
  }

  const handleGetActionPlan = async () => {
    setGeneratingPlan(true)
    setError(null)
    try {
      const result = await window.electronAPI.generateActionPlan(goal.id)
      onReload()
      // Auto-expand the action plan
      setExpandedTopic('action-plan')
    } catch (err: any) {
      setError(err.message || 'Failed to generate action plan')
    } finally {
      setGeneratingPlan(false)
    }
  }

  const attachedFiles = goal.contextFiles || []

  const isSuggested = (file: ContextFile): boolean => {
    const keywords = `${goal.title} ${goal.description} ${goal.category} ${goal.tags.join(' ')}`.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const fileLower = file.content.toLowerCase()
    return keywords.some(kw => fileLower.includes(kw))
  }

  const toggleContextFile = async (filename: string) => {
    const current = goal.contextFiles || []
    const updated = current.includes(filename)
      ? current.filter(f => f !== filename)
      : [...current, filename]
    await onUpdateGoal({ contextFiles: updated })
  }

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(false)} className="text-[11px] text-muted hover:text-white/70 mb-3 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <GoalForm
          initial={goal}
          onSave={async (data) => {
            await onUpdateGoal(data)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const actionPlan = goal.topicReports?.find(r => r.type === 'action_plan' as any)

  return (
    <div className="space-y-4">
      {/* Back + goal header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1 text-muted hover:text-white/70 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <h2 className="text-base font-semibold text-white/90 truncate">{goal.title}</h2>
          </div>
          {goal.description && (
            <p className="text-xs text-muted leading-relaxed ml-[18px]">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="px-2.5 py-1 rounded-md bg-white/[0.06] text-muted text-[10px] font-medium hover:bg-white/[0.1] hover:text-white/70 transition-all"
          >Edit</button>
          <button
            onClick={async () => {
              if (deleteConfirm) {
                await onDeleteGoal()
              } else {
                setDeleteConfirm(true)
                setTimeout(() => setDeleteConfirm(false), 3000)
              }
            }}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
              deleteConfirm ? 'bg-accent-red/20 text-accent-red' : 'text-muted/40 hover:text-accent-red'
            }`}
          >{deleteConfirm ? 'Confirm?' : 'Delete'}</button>
        </div>
      </div>

      {/* Progress bar */}
      {(totalTopics > 0 || tasks.length > 0) && (() => {
        const researchPct = totalTopics > 0 ? Math.round((researchedCount / totalTopics) * 100) : 0
        const taskPct = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0
        const overallPct = totalTopics + tasks.length > 0
          ? Math.round(((researchedCount + completedTasks.length) / (totalTopics + tasks.length)) * 100)
          : 0
        const phase = completedTasks.length === tasks.length && tasks.length > 0 && researchedCount === totalTopics
          ? 'Complete'
          : tasks.some(t => t.status === 'launched' || t.status === 'running')
            ? 'Executing'
            : actionPlan
              ? 'Planning'
              : 'Researching'
        return (
          <div className="ml-7 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-surface-3/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-blue transition-all duration-500"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <span className="text-[9px] text-muted/60 flex-shrink-0">{overallPct}%</span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-white/[0.06] text-muted">{phase}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[8px] text-accent-purple/70 flex-shrink-0">Research</span>
                <div className="flex-1 h-1 rounded-full bg-surface-3/40 overflow-hidden">
                  <div className="h-full rounded-full bg-accent-purple/60 transition-all duration-500" style={{ width: `${researchPct}%` }} />
                </div>
                <span className="text-[8px] text-muted/40">{researchedCount}/{totalTopics}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-[8px] text-accent-emerald/70 flex-shrink-0">Tasks</span>
                <div className="flex-1 h-1 rounded-full bg-surface-3/40 overflow-hidden">
                  <div className="h-full rounded-full bg-accent-emerald/60 transition-all duration-500" style={{ width: `${taskPct}%` }} />
                </div>
                <span className="text-[8px] text-muted/40">{completedTasks.length}/{tasks.length}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tab toggle */}
      <div className="flex items-center gap-1 ml-7 border-b border-white/[0.06] pb-0">
        <button
          onClick={() => setActiveTab('research')}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-t-md transition-all ${
            activeTab === 'research'
              ? 'bg-surface-2/80 text-white/90 border border-b-0 border-white/[0.08]'
              : 'text-muted hover:text-white/60'
          }`}
        >
          Research
          {totalTopics > 0 && <span className="ml-1.5 text-[9px] text-muted/50">{researchedCount}/{totalTopics}</span>}
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-t-md transition-all ${
            activeTab === 'tasks'
              ? 'bg-surface-2/80 text-white/90 border border-b-0 border-white/[0.08]'
              : 'text-muted hover:text-white/60'
          }`}
        >
          Tasks
          {tasks.length > 0 && <span className="ml-1.5 text-[9px] text-muted/50">{completedTasks.length}/{tasks.length}</span>}
        </button>
      </div>

      {/* ===== RESEARCH TAB ===== */}
      {activeTab === 'research' && <>

      {/* Action buttons */}
      <div className="flex items-center gap-2 ml-7">
        <button
          onClick={handleFindTopicsClick}
          disabled={findingTopics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue/15 text-accent-blue text-[11px] font-medium hover:bg-accent-blue/25 transition-all disabled:opacity-50"
        >
          {findingTopics ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          )}
          {findingTopics ? 'Finding Topics...' : 'Find Topics'}
        </button>
        {totalTopics > 0 && (
          <button
            onClick={handleResearchAll}
            disabled={researchingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/15 text-accent-purple text-[11px] font-medium hover:bg-accent-purple/25 transition-all disabled:opacity-50"
          >
            {researchingAll ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            {researchingAll ? 'Researching...' : `Research All (${researchedCount}/${totalTopics})`}
          </button>
        )}
      </div>

      {/* Direction Prompt for Find Topics */}
      {showDirectionPrompt && (
        <div className="ml-7 rounded-lg border border-accent-blue/20 bg-surface-2/80 p-3 space-y-2.5">
          <div className="text-xs text-white/80 font-medium">Any specific direction you want to explore?</div>
          <input
            type="text"
            value={topicDirection}
            onChange={(e) => setTopicDirection(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFindTopics(topicDirection) }}
            placeholder="e.g. focus on costs and budgeting, or legal requirements..."
            autoFocus
            className="w-full px-3 py-1.5 rounded-md bg-surface-3/80 border border-white/[0.08] text-xs text-white/90 placeholder:text-muted/40 focus:outline-none focus:border-accent-blue/40"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFindTopics(topicDirection)}
              className="px-3 py-1 rounded-md bg-accent-blue/20 text-accent-blue text-[11px] font-medium hover:bg-accent-blue/30 transition-all"
            >
              {topicDirection.trim() ? 'Find with Direction' : 'Find All Topics'}
            </button>
            <button
              onClick={() => setShowDirectionPrompt(false)}
              className="px-3 py-1 rounded-md bg-white/[0.06] text-muted text-[11px] font-medium hover:bg-white/[0.1] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Context Files */}
      {contextFiles.length > 0 && (
        <div className="ml-7">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-[10px] text-muted uppercase tracking-wider">Context</h4>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {attachedFiles.map(name => (
                  <span
                    key={name}
                    onClick={() => toggleContextFile(name)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue text-[9px] font-medium cursor-pointer hover:bg-accent-blue/25 transition-all"
                  >
                    {name}
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowContextPicker(!showContextPicker)}
              className="px-2 py-0.5 rounded-md bg-surface-3 hover:bg-surface-4 text-[9px] text-muted hover:text-white transition-all"
            >
              {showContextPicker ? 'Close' : 'Attach Context'}
            </button>
          </div>
          {showContextPicker && (
            <div className="rounded-lg border border-white/[0.06] bg-surface-2/60 p-2 space-y-1 mb-3">
              {contextFiles.map(file => {
                const isAttached = attachedFiles.includes(file.name)
                const suggested = !isAttached && isSuggested(file)
                return (
                  <label
                    key={file.name}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-3/60 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={isAttached}
                      onChange={() => toggleContextFile(file.name)}
                      className="w-3 h-3 rounded bg-surface-3 border-white/10 accent-accent-blue"
                    />
                    <span className="text-[11px] text-white/80 flex-1">{file.name}</span>
                    {suggested && (
                      <span className="px-1.5 py-0.5 rounded-md bg-accent-purple/15 text-accent-purple text-[8px] font-medium">Suggested</span>
                    )}
                    <span className="text-[9px] text-muted/40">
                      {new Date(file.modifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      </>}

      {/* ===== TASKS TAB ===== */}
      {activeTab === 'tasks' && <>

      {/* Tasks action bar */}
      <div className="flex items-center gap-2 ml-7 flex-wrap">
        {researchedCount > 0 && (
          <button
            onClick={handleGetActionPlan}
            disabled={generatingPlan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-emerald/15 text-accent-emerald text-[11px] font-medium hover:bg-accent-emerald/25 transition-all disabled:opacity-50"
          >
            {generatingPlan ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            )}
            {generatingPlan ? 'Generating...' : actionPlan ? 'Regenerate Steps' : 'Get Best Steps'}
          </button>
        )}
      </div>

      {!actionPlan && tasks.length === 0 && (
        <div className="ml-7 text-center py-8 rounded-xl border border-white/[0.06] bg-surface-1/40">
          <p className="text-sm text-muted mb-1">No action plan yet</p>
          <p className="text-xs text-muted/50">{researchedCount > 0 ? 'Click "Get Best Steps" to generate an action plan from your research.' : 'Research topics on the Research tab first, then generate action steps here.'}</p>
        </div>
      )}

      {/* Action Plan (if exists) */}
      {actionPlan && (
        <div className="ml-7">
          <button
            onClick={() => setExpandedTopic(expandedTopic === 'action-plan' ? null : 'action-plan')}
            className="w-full text-left rounded-lg border border-accent-emerald/20 bg-accent-emerald/5 hover:bg-accent-emerald/10 transition-all"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              <span className="text-sm font-medium text-accent-emerald flex-1">Action Plan</span>
              <span className="text-[10px] text-muted">
                {new Date(actionPlan.generatedAt).toLocaleDateString()}
              </span>
              <svg className={`w-3.5 h-3.5 text-muted transition-transform ${expandedTopic === 'action-plan' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {expandedTopic === 'action-plan' && (
            <div className="border border-t-0 border-accent-emerald/10 rounded-b-lg bg-surface-1/40 px-4 py-3">
              <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed">{actionPlan.report}</div>
            </div>
          )}
        </div>
      )}

      {/* Task Extraction & Execution */}
      {actionPlan && (
        <div className="ml-7 space-y-3">
          {/* Extract / Re-extract / Launch buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtractTasks}
              disabled={extracting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-orange/15 text-accent-orange text-[11px] font-medium hover:bg-accent-orange/25 transition-all disabled:opacity-50"
            >
              {extracting ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              )}
              {extracting ? 'Extracting...' : tasks.length > 0 ? 'Re-extract Tasks' : 'Extract Tasks'}
            </button>
            {pendingTasks.length > 0 && (
              <>
                {selectedPendingIds.length > 0 ? (
                  <button
                    onClick={() => handleLaunchTasks(selectedPendingIds)}
                    disabled={launching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-emerald/15 text-accent-emerald text-[11px] font-medium hover:bg-accent-emerald/25 transition-all disabled:opacity-50"
                  >
                    {launching ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    Launch Selected ({selectedPendingIds.length})
                  </button>
                ) : (
                  <button
                    onClick={() => handleLaunchTasks()}
                    disabled={launching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-emerald/15 text-accent-emerald text-[11px] font-medium hover:bg-accent-emerald/25 transition-all disabled:opacity-50"
                  >
                    {launching ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    Launch All ({Math.min(pendingTasks.length, 10)})
                  </button>
                )}
              </>
            )}
            {tasks.some(t => t.status === 'launched' || t.status === 'running') && (
              <span className="text-[10px] text-accent-blue flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Polling sessions...
              </span>
            )}
          </div>

          {/* Task list grouped by priority */}
          {tasks.length > 0 && (
            <div className="space-y-2">
              {(['critical', 'high', 'medium', 'low'] as const).map(priority => {
                const group = tasks.filter(t => t.priority === priority)
                if (group.length === 0) return null
                const priorityColors = {
                  critical: 'text-red-400 bg-red-400/15',
                  high: 'text-orange-400 bg-orange-400/15',
                  medium: 'text-yellow-400 bg-yellow-400/15',
                  low: 'text-blue-400 bg-blue-400/15',
                }
                const statusColors: Record<string, string> = {
                  pending: 'text-muted bg-white/[0.06]',
                  launched: 'text-accent-blue bg-accent-blue/15',
                  running: 'text-accent-purple bg-accent-purple/15',
                  completed: 'text-green-400 bg-green-400/15',
                  failed: 'text-red-400 bg-red-400/15',
                }
                return (
                  <div key={priority}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${priorityColors[priority]}`}>
                        {priority}
                      </span>
                      <span className="text-[10px] text-muted">{group.length} task{group.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1">
                      {group.map(task => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-white/[0.06] bg-surface-2/40 hover:bg-surface-2/60 transition-all"
                        >
                          {task.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id)}
                              onChange={() => toggleTaskSelection(task.id)}
                              className="mt-0.5 w-3 h-3 rounded bg-surface-3 border-white/10 accent-accent-blue flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-white/85 font-medium truncate">{task.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium flex-shrink-0 ${statusColors[task.status] || statusColors.pending}`}>
                                {task.status}
                              </span>
                              {task.taskType && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium flex-shrink-0 ${
                                  {
                                    research: 'text-cyan-400 bg-cyan-400/15',
                                    code: 'text-emerald-400 bg-emerald-400/15',
                                    writing: 'text-amber-400 bg-amber-400/15',
                                    planning: 'text-violet-400 bg-violet-400/15',
                                    communication: 'text-pink-400 bg-pink-400/15',
                                  }[task.taskType] || 'text-muted bg-white/[0.06]'
                                }`}>
                                  {task.taskType}
                                </span>
                              )}
                            </div>
                            {task.phase && task.phase !== 'Unphased' && (
                              <span className="text-[9px] text-muted/60">{task.phase}</span>
                            )}
                            <p className="text-[10px] text-muted/70 line-clamp-2 mt-0.5">{task.description}</p>
                          </div>
                          {(task.status === 'launched' || task.status === 'running') && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                                className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-green-400/15 text-green-400 hover:bg-green-400/25 transition-all"
                                title="Mark completed"
                              >Done</button>
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, 'failed')}
                                className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-red-400/15 text-red-400 hover:bg-red-400/25 transition-all"
                                title="Mark failed"
                              >Fail</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Orchestrator Log Panel */}
      {(orchLines.length > 0 || orchRunning) && (
        <div className="ml-7">
          <button
            onClick={() => setOrchExpanded(!orchExpanded)}
            className={`w-full text-left rounded-lg border ${orchRunning ? 'border-green-400/20 bg-green-400/5' : 'border-white/[0.08] bg-surface-2/40'} hover:bg-surface-2/60 transition-all`}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              {orchRunning && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                </span>
              )}
              {!orchRunning && <span className="w-2.5 h-2.5 rounded-full bg-muted/40 flex-shrink-0" />}
              <span className="text-sm font-medium text-white/80 flex-1">
                Orchestrator {orchRunning ? 'Running' : 'Output'}
              </span>
              <span className="text-[9px] text-muted/50">{orchLines.length} lines</span>
              {orchRunning && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStopOrchestrator() }}
                  className="px-2 py-0.5 rounded-md bg-accent-red/15 text-accent-red text-[9px] font-medium hover:bg-accent-red/25 transition-all"
                >
                  Stop
                </button>
              )}
              <svg className={`w-3.5 h-3.5 text-muted transition-transform ${orchExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {orchExpanded && (
            <div
              ref={orchLogRef}
              className="border border-t-0 border-white/[0.06] rounded-b-lg bg-surface-0/80 px-3 py-2 max-h-[300px] overflow-y-auto font-mono"
            >
              {orchLines.map((line, i) => (
                <div
                  key={i}
                  className={`text-[10px] leading-relaxed ${
                    line.startsWith('[stderr]') ? 'text-accent-red/70' :
                    line.startsWith('[orchestrator]') ? 'text-accent-blue/70' :
                    'text-white/60'
                  }`}
                >
                  {line}
                </div>
              ))}
              {orchRunning && (
                <div className="text-[10px] text-muted/40 animate-pulse mt-1">Waiting for output...</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agent Workspace */}
      {workspace && (
        <div className="ml-7">
          <button
            onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
            className="w-full text-left rounded-lg border border-accent-blue/20 bg-accent-blue/5 hover:bg-accent-blue/10 transition-all"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span className="text-sm font-medium text-accent-blue flex-1">Agent Workspace</span>
              {deliverables.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent-blue/15 text-accent-blue">
                  {deliverables.length} file{deliverables.length !== 1 ? 's' : ''}
                </span>
              )}
              <svg className={`w-3.5 h-3.5 text-muted transition-transform ${workspaceExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {workspaceExpanded && (
            <div className="border border-t-0 border-accent-blue/10 rounded-b-lg bg-surface-1/40 px-4 py-3 space-y-3">
              {deliverables.length > 0 && (
                <div>
                  <h5 className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Deliverables</h5>
                  <div className="space-y-1">
                    {deliverables.map(file => (
                      <div key={file.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2/40">
                        <svg className="w-3 h-3 text-accent-blue/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <span className="text-[11px] text-white/80 flex-1 truncate">{file.name}</span>
                        <span className="text-[9px] text-muted/50">
                          {file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                {workspace}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extract Learnings button (Feature 3) */}
      {completedTasks.length > 0 && (
        <div className="ml-7 flex items-center gap-2">
          <button
            onClick={handleExtractLearnings}
            disabled={extractingLearnings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/15 text-accent-purple text-[11px] font-medium hover:bg-accent-purple/25 transition-all disabled:opacity-50"
          >
            {extractingLearnings ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            )}
            {extractingLearnings ? 'Extracting...' : 'Extract Learnings'}
          </button>
          {learningsResult !== null && (
            <span className="text-[10px] text-accent-purple">
              {learningsResult.count} {learningsResult.count === 1 ? 'memory' : 'memories'} created
            </span>
          )}
        </div>
      )}

      {/* Goal Repository */}
      {repoInfo && (
        <div className="ml-7">
          <button
            onClick={() => setRepoExpanded(!repoExpanded)}
            className="w-full text-left rounded-lg border border-accent-emerald/20 bg-accent-emerald/5 hover:bg-accent-emerald/10 transition-all"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <span className="text-sm font-medium text-accent-emerald flex-1">Goal Repository</span>
              <div className="flex items-center gap-3">
                {repoInfo.commitCount > 1 && (
                  <span className="text-[9px] text-muted/60">{repoInfo.commitCount - 1} commit{repoInfo.commitCount - 1 !== 1 ? 's' : ''}</span>
                )}
                {repoInfo.fileCount > 0 && (
                  <span className="text-[9px] text-muted/60">{repoInfo.fileCount} file{repoInfo.fileCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              <svg className={`w-3.5 h-3.5 text-muted transition-transform ${repoExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {repoExpanded && (
            <div className="border border-t-0 border-accent-emerald/10 rounded-b-lg bg-surface-1/40 px-4 py-3 space-y-3">
              {/* Repo path */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2/30">
                <svg className="w-3 h-3 text-muted/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <code className="text-[10px] text-muted/70 font-mono truncate flex-1">{repoInfo.path}</code>
                {repoInfo.sizeBytes > 0 && (
                  <span className="text-[9px] text-muted/40 flex-shrink-0">
                    {repoInfo.sizeBytes < 1024 ? `${repoInfo.sizeBytes} B` : repoInfo.sizeBytes < 1048576 ? `${(repoInfo.sizeBytes / 1024).toFixed(1)} KB` : `${(repoInfo.sizeBytes / 1048576).toFixed(1)} MB`}
                  </span>
                )}
              </div>
              {/* Commit log */}
              {gitLog.length > 0 ? (
                <div>
                  <h5 className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Commits</h5>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {gitLog.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-2/40">
                        <code className="text-[9px] font-mono text-accent-emerald/70 flex-shrink-0">{entry.hash}</code>
                        <span className="text-[11px] text-white/75 flex-1 truncate">{entry.message}</span>
                        <span className="text-[9px] text-muted/50 flex-shrink-0">
                          {entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-muted/50 text-center py-2">No agent commits yet. Launch tasks to start building.</p>
              )}
            </div>
          )}
        </div>
      )}

      </>}

      {activeTab === 'research' && <>

      {/* Topics with inline reports — grouped by theme */}
      {allTopics.length > 0 && (() => {
        // Helper: find the original array index for a topic so research IPC works
        const getTopicIndex = (text: string, type: 'question' | 'guidance'): number => {
          const arr = type === 'question' ? goal.research_questions : goal.guidance_needed
          return arr.indexOf(text)
        }

        const groups = goal.topicGroups && goal.topicGroups.length > 0
          ? goal.topicGroups
          : null

        return (
          <div className="ml-7 space-y-4">
            <div className="flex items-center gap-2 px-1">
              <h4 className="text-[10px] text-muted uppercase tracking-wider">Research Topics</h4>
              <span className="text-[9px] text-muted/50">{researchedCount}/{totalTopics} researched</span>
              {!groups && totalTopics > 3 && (
                <button
                  onClick={handleCategorizeTopics}
                  disabled={categorizing}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-purple/10 text-accent-purple text-[9px] font-medium hover:bg-accent-purple/20 transition-all disabled:opacity-50"
                >
                  {categorizing ? (
                    <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  )}
                  {categorizing ? 'Organizing...' : 'Organize'}
                </button>
              )}
              {groups && (
                <button
                  onClick={handleCategorizeTopics}
                  disabled={categorizing}
                  className="text-[9px] text-muted/40 hover:text-accent-purple transition-colors disabled:opacity-50"
                >
                  {categorizing ? 'Reorganizing...' : 'Re-organize'}
                </button>
              )}
              {stubCount > 0 && (
                <button
                  onClick={handlePurgeStubs}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-red/10 text-accent-red text-[9px] font-medium hover:bg-accent-red/20 transition-all ml-auto"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Purge {stubCount} stub{stubCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            {groups ? (
              /* Themed groups from LLM categorization */
              groups.map((group, gi) => (
                <div key={gi} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-purple/50" />
                    <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">{group.label}</span>
                    <span className="text-[9px] text-muted/40">{group.topics.length}</span>
                  </div>
                  {group.topics.map((topic, ti) => {
                    const idx = getTopicIndex(topic.text, topic.type)
                    const report = hasReport(topic.text, topic.type)
                    const key = `${topic.type}-${idx >= 0 ? idx : `g${gi}-${ti}`}`
                    const isExpanded = expandedTopic === key
                    const isResearching = researchingIdx === key
                    const isStub = report ? isStubReport(report.report) : false
                    return (
                      <TopicRow key={key} text={topic.text} type={topic.type} index={idx >= 0 ? idx : 0} report={report} isExpanded={isExpanded} isResearching={isResearching} isStub={isStub} setExpandedTopic={setExpandedTopic} handleResearchTopic={handleResearchTopic} handleRemoveReport={handleRemoveReport} topicKey={key} />
                    )
                  })}
                </div>
              ))
            ) : (
              /* Fallback: split by question vs guidance */
              <>
                {goal.research_questions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      <svg className="w-3 h-3 text-accent-blue/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-[10px] text-accent-blue/70 font-medium uppercase tracking-wider">Research Questions</span>
                      <span className="text-[9px] text-muted/40">{goal.research_questions.length}</span>
                    </div>
                    {goal.research_questions.map((q, i) => {
                      const report = hasReport(q, 'question')
                      const key = `question-${i}`
                      const isExpanded = expandedTopic === key
                      const isResearching = researchingIdx === key
                      const isStub = report ? isStubReport(report.report) : false
                      return (
                        <TopicRow key={key} text={q} type="question" index={i} report={report} isExpanded={isExpanded} isResearching={isResearching} isStub={isStub} setExpandedTopic={setExpandedTopic} handleResearchTopic={handleResearchTopic} handleRemoveReport={handleRemoveReport} topicKey={key} />
                      )
                    })}
                  </div>
                )}
                {goal.guidance_needed.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      <svg className="w-3 h-3 text-accent-emerald/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      <span className="text-[10px] text-accent-emerald/70 font-medium uppercase tracking-wider">Guidance Needed</span>
                      <span className="text-[9px] text-muted/40">{goal.guidance_needed.length}</span>
                    </div>
                    {goal.guidance_needed.map((g, i) => {
                      const report = hasReport(g, 'guidance')
                      const key = `guidance-${i}`
                      const isExpanded = expandedTopic === key
                      const isResearching = researchingIdx === key
                      const isStub = report ? isStubReport(report.report) : false
                      return (
                        <TopicRow key={key} text={g} type="guidance" index={i} report={report} isExpanded={isExpanded} isResearching={isResearching} isStub={isStub} setExpandedTopic={setExpandedTopic} handleResearchTopic={handleResearchTopic} handleRemoveReport={handleRemoveReport} topicKey={key} />
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}

      {totalTopics === 0 && (
        <div className="ml-7 flex flex-col items-center py-10 text-center rounded-xl border border-white/[0.06] bg-surface-1/40">
          <p className="text-muted text-sm mb-2">No research topics yet</p>
          <p className="text-xs text-muted/60">Click "Find Topics" above to have AI generate research topics, or edit the goal manually.</p>
        </div>
      )}

      </>}

      {/* Research Queue Panel (replaces spinner during Research All) */}
      {researchingAll && researchProgress && (
        <div className="ml-7 rounded-lg border border-accent-purple/20 bg-surface-2/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/80">
              Researching {researchProgress.completedCount}/{researchProgress.totalCount}...
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted/50">{formatElapsed(researchElapsed)}</span>
              <button
                onClick={handleCancelResearch}
                className="px-2 py-0.5 rounded-md bg-accent-red/15 text-accent-red text-[9px] font-medium hover:bg-accent-red/25 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-blue transition-all duration-300"
              style={{ width: `${researchProgress.totalCount > 0 ? (researchProgress.completedCount / researchProgress.totalCount) * 100 : 0}%` }}
            />
          </div>
          {researchProgress.currentTopic && (
            <p className="text-[10px] text-muted/70 truncate">
              <span className="text-accent-purple/70">{researchProgress.currentTopicType === 'question' ? 'Q' : 'G'}:</span>{' '}
              {researchProgress.currentTopic}
            </p>
          )}
          {researchProgress.error && (
            <p className="text-[10px] text-accent-red/80">Error: {researchProgress.error}</p>
          )}
        </div>
      )}

      {/* Activity Feed */}
      {goal.activityLog && goal.activityLog.length > 0 && (
        <div className="ml-7">
          <button
            onClick={() => setActivityExpanded(!activityExpanded)}
            className="flex items-center gap-2 text-[10px] text-muted/60 hover:text-muted transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${activityExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            Activity ({goal.activityLog.length})
          </button>
          {activityExpanded && (
            <div className="mt-1.5 space-y-1 max-h-[200px] overflow-y-auto">
              {goal.activityLog.map((entry: GoalActivityEntry) => (
                <div key={entry.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-surface-2/30">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activityDotColors[entry.type] || 'bg-muted/40'}`} />
                  <span className="text-[10px] text-white/70 flex-1 truncate">{entry.description}</span>
                  <span className="text-[8px] text-muted/40 flex-shrink-0">{relativeTime(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="ml-7 rounded-lg bg-accent-red/10 border border-accent-red/20 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}
    </div>
  )
}
