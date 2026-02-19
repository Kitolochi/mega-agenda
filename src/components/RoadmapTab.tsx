import { useState, useEffect, useCallback } from 'react'
import { RoadmapGoal, RoadmapGoalCategory, RoadmapGoalStatus, RoadmapSubGoal } from '../types'

const CATEGORIES: { id: RoadmapGoalCategory; label: string; color: string }[] = [
  { id: 'career', label: 'Career', color: '#6C8EEF' },
  { id: 'health', label: 'Health', color: '#34D399' },
  { id: 'financial', label: 'Financial', color: '#FBBF24' },
  { id: 'relationships', label: 'Relationships', color: '#F472B6' },
  { id: 'learning', label: 'Learning', color: '#A78BFA' },
  { id: 'projects', label: 'Projects', color: '#FB923C' },
  { id: 'personal', label: 'Personal', color: '#2DD4BF' },
  { id: 'creative', label: 'Creative', color: '#F87171' },
]

const STATUSES: { id: RoadmapGoalStatus; label: string }[] = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'on_hold', label: 'On Hold' },
]

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const PRIORITY_COLORS: Record<string, string> = { low: '#60a5fa', medium: '#fbbf24', high: '#fb923c', critical: '#f87171' }

function catColor(cat: RoadmapGoalCategory): string {
  return CATEGORIES.find(c => c.id === cat)?.color || '#888'
}

function statusIcon(s: RoadmapGoalStatus): string {
  return s === 'completed' ? 'x' : s === 'in_progress' ? '~' : s === 'on_hold' ? '-' : ' '
}

function currentQuarter(): { q: number; y: number } {
  const now = new Date()
  return { q: Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4, y: now.getFullYear() }
}

const emptyGoal = (): Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'> => {
  const cur = currentQuarter()
  return {
    title: '',
    description: '',
    category: 'projects',
    targetQuarter: cur.q as 1 | 2 | 3 | 4,
    targetYear: cur.y,
    priority: 'medium',
    status: 'not_started',
    research_questions: [],
    guidance_needed: [],
    notes: '',
    sub_goals: [],
    tags: [],
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default function RoadmapTab() {
  const [goals, setGoals] = useState<RoadmapGoal[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [viewMode, setViewMode] = useState<'timeline' | 'board'>('timeline')
  const [filterCategory, setFilterCategory] = useState<RoadmapGoalCategory | null>(null)
  const [filterStatus, setFilterStatus] = useState<RoadmapGoalStatus | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [researchingId, setResearchingId] = useState<string | null>(null)
  const [researchResult, setResearchResult] = useState<{ goalId: string; report: string; filePath: string } | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)

  const handleResearch = async (goalId: string) => {
    setResearchingId(goalId)
    setResearchError(null)
    setResearchResult(null)
    try {
      const result = await window.electronAPI.researchRoadmapGoal(goalId)
      setResearchResult({ goalId, report: result.report, filePath: result.filePath })
    } catch (err: any) {
      setResearchError(err.message || 'Research failed')
    } finally {
      setResearchingId(null)
    }
  }

  const loadGoals = useCallback(async () => {
    const data = await window.electronAPI.getRoadmapGoals()
    setGoals(data)
  }, [])

  useEffect(() => { loadGoals() }, [loadGoals])

  const filtered = goals.filter(g => {
    if (filterCategory && g.category !== filterCategory) return false
    if (filterStatus && g.status !== filterStatus) return false
    return true
  })

  const inProgressCount = goals.filter(g => g.status === 'in_progress').length

  const cur = currentQuarter()

  // Timeline view: group by year, then quarter
  const years = [...new Set(filtered.map(g => g.targetYear))].sort()

  // Board view: group by category
  const byCategory = CATEGORIES.map(c => ({
    ...c,
    goals: filtered.filter(g => g.category === c.id)
  })).filter(c => c.goals.length > 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 className="text-lg font-display font-semibold text-white">Roadmap</h2>
          <span className="text-xs text-muted">{goals.length} goal{goals.length !== 1 ? 's' : ''} · {inProgressCount} in progress</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'timeline' ? 'bg-accent-blue/20 text-accent-blue' : 'text-muted hover:text-white/70'}`}
            >Timeline</button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'board' ? 'bg-accent-blue/20 text-accent-blue' : 'text-muted hover:text-white/70'}`}
            >Board</button>
          </div>
          <button
            onClick={() => { setShowAddForm(true); setExpandedId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Goal
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="flex gap-1 items-center flex-wrap">
          <span className="text-[10px] text-muted mr-1 uppercase tracking-wider">Category</span>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(filterCategory === c.id ? null : c.id)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
                filterCategory === c.id
                  ? 'border-white/20 text-white'
                  : 'border-transparent text-muted hover:text-white/70'
              }`}
              style={filterCategory === c.id ? { backgroundColor: c.color + '30', borderColor: c.color + '50' } : {}}
            >{c.label}</button>
          ))}
        </div>
        <div className="flex gap-1 items-center flex-wrap">
          <span className="text-[10px] text-muted mr-1 uppercase tracking-wider">Status</span>
          {STATUSES.map(s => (
            <button
              key={s.id}
              onClick={() => setFilterStatus(filterStatus === s.id ? null : s.id)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
                filterStatus === s.id
                  ? 'border-accent-blue/50 bg-accent-blue/20 text-accent-blue'
                  : 'border-transparent text-muted hover:text-white/70'
              }`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <GoalForm
          initial={emptyGoal()}
          onSave={async (data) => {
            await window.electronAPI.createRoadmapGoal(data)
            setShowAddForm(false)
            loadGoals()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Empty State */}
      {!showAddForm && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-12 h-12 text-muted mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-muted text-sm mb-3">No goals yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all"
          >Add your first goal</button>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && filtered.length > 0 && (
        <div className="space-y-6">
          {years.map(year => {
            const yearGoals = filtered.filter(g => g.targetYear === year)
            return (
              <div key={year}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-sm font-display font-semibold text-white/60">{year}</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {([1, 2, 3, 4] as const).map(q => {
                    const qGoals = yearGoals.filter(g => g.targetQuarter === q)
                    const isCurrent = year === cur.y && q === cur.q
                    const qLabels = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec']
                    return (
                      <div
                        key={q}
                        className={`rounded-xl border p-3 min-h-[120px] transition-all ${
                          isCurrent
                            ? 'border-accent-blue/30 bg-accent-blue/[0.04]'
                            : 'border-white/[0.04] bg-surface-1/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[11px] font-semibold ${isCurrent ? 'text-accent-blue' : 'text-muted'}`}>
                            Q{q} <span className="font-normal text-[10px]">({qLabels[q - 1]})</span>
                          </span>
                          {isCurrent && <span className="text-[8px] bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded-full font-medium">NOW</span>}
                        </div>
                        <div className="space-y-2">
                          {qGoals.map(g => (
                            <GoalCard
                              key={g.id}
                              goal={g}
                              expanded={expandedId === g.id}
                              onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
                              onUpdate={async (updates) => {
                                await window.electronAPI.updateRoadmapGoal(g.id, updates)
                                loadGoals()
                              }}
                              onDelete={async () => {
                                if (deleteConfirmId === g.id) {
                                  await window.electronAPI.deleteRoadmapGoal(g.id)
                                  setDeleteConfirmId(null)
                                  setExpandedId(null)
                                  loadGoals()
                                } else {
                                  setDeleteConfirmId(g.id)
                                }
                              }}
                              deleteConfirm={deleteConfirmId === g.id}
                              onResearch={() => handleResearch(g.id)}
                              isResearching={researchingId === g.id}
                              researchResult={researchResult?.goalId === g.id ? researchResult : null}
                              researchError={researchingId === null && researchError && researchResult === null ? researchError : null}
                            />
                          ))}
                          {qGoals.length === 0 && (
                            <p className="text-[10px] text-muted/50 text-center py-4">—</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Board View */}
      {viewMode === 'board' && filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {byCategory.map(cat => (
            <div key={cat.id} className="rounded-xl border border-white/[0.04] bg-surface-1/40 p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-semibold text-white/80">{cat.label}</span>
                <span className="text-[10px] text-muted">{cat.goals.length}</span>
              </div>
              <div className="space-y-2">
                {cat.goals.map(g => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    expanded={expandedId === g.id}
                    onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
                    onUpdate={async (updates) => {
                      await window.electronAPI.updateRoadmapGoal(g.id, updates)
                      loadGoals()
                    }}
                    onDelete={async () => {
                      if (deleteConfirmId === g.id) {
                        await window.electronAPI.deleteRoadmapGoal(g.id)
                        setDeleteConfirmId(null)
                        setExpandedId(null)
                        loadGoals()
                      } else {
                        setDeleteConfirmId(g.id)
                      }
                    }}
                    deleteConfirm={deleteConfirmId === g.id}
                    onResearch={() => handleResearch(g.id)}
                    isResearching={researchingId === g.id}
                    researchResult={researchResult?.goalId === g.id ? researchResult : null}
                    researchError={researchingId === null && researchError && researchResult === null ? researchError : null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Goal Card ───
interface GoalCardProps {
  goal: RoadmapGoal
  expanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<RoadmapGoal>) => void
  onDelete: () => void
  deleteConfirm: boolean
  onResearch?: () => void
  isResearching?: boolean
  researchResult?: { report: string; filePath: string } | null
  researchError?: string | null
}

function GoalCard({ goal, expanded, onToggle, onUpdate, onDelete, deleteConfirm, onResearch, isResearching, researchResult, researchError }: GoalCardProps) {
  const color = catColor(goal.category)
  const doneCount = goal.sub_goals.filter(s => s.status === 'completed').length
  const totalSubs = goal.sub_goals.length

  if (expanded) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-surface-2/80 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.04]" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
          <span className="text-[10px] font-semibold text-white/80 flex-1 truncate">{goal.title || 'Untitled'}</span>
          <button onClick={onToggle} className="text-muted hover:text-white/60 p-0.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
          </button>
        </div>
        <GoalForm
          initial={goal}
          onSave={async (data) => {
            await onUpdate(data)
            onToggle()
          }}
          onCancel={onToggle}
          onDelete={onDelete}
          deleteConfirm={deleteConfirm}
          isEdit
        />
      </div>
    )
  }

  const hasResearchNeeds = goal.research_questions.length > 0 || goal.guidance_needed.length > 0

  return (
    <div
      className="w-full text-left rounded-lg border border-white/[0.06] bg-surface-2/60 hover:bg-surface-2/80 transition-all group overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <button onClick={onToggle} className="w-full text-left">
        <div className="px-2.5 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[goal.priority] }} />
            <span className="text-[11px] font-medium text-white/90 truncate flex-1">{goal.title || 'Untitled'}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '20', color }}>
              {goal.category}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
              goal.status === 'in_progress' ? 'bg-accent-blue/20 text-accent-blue' :
              goal.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              goal.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-white/[0.06] text-muted'
            }`}>
              [{statusIcon(goal.status)}] {goal.status.replace('_', ' ')}
            </span>
            {totalSubs > 0 && (
              <span className="text-[9px] text-muted">{doneCount}/{totalSubs}</span>
            )}
            {goal.research_questions.length > 0 && (
              <span className="text-[9px] text-muted" title="Research questions">?{goal.research_questions.length}</span>
            )}
          </div>
        </div>
      </button>
      {/* Research button row */}
      {hasResearchNeeds && (
        <div className="px-2.5 pb-2 flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onResearch?.() }}
            disabled={isResearching}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-purple/15 text-accent-purple text-[9px] font-medium hover:bg-accent-purple/25 transition-all disabled:opacity-50"
            title="Research this goal with Tavily + Claude"
          >
            {isResearching ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            {isResearching ? 'Researching...' : 'Research'}
          </button>
          {researchResult && (
            <span className="text-[9px] text-accent-emerald font-medium">Report saved</span>
          )}
          {researchError && (
            <span className="text-[9px] text-accent-red font-medium truncate" title={researchError}>{researchError}</span>
          )}
        </div>
      )}
      {/* Inline research report preview */}
      {researchResult && (
        <div className="px-2.5 pb-2">
          <div className="rounded-md bg-surface-3/50 border border-white/[0.06] p-2 max-h-40 overflow-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-accent-purple font-medium uppercase tracking-wider">Research Report</span>
              <span className="text-[8px] text-muted truncate ml-2" title={researchResult.filePath}>{researchResult.filePath.split(/[/\\]/).pop()}</span>
            </div>
            <div className="text-[10px] text-white/70 whitespace-pre-wrap leading-relaxed">{researchResult.report.slice(0, 600)}{researchResult.report.length > 600 ? '...' : ''}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Goal Form (used for both add + edit) ───
interface GoalFormProps {
  initial: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'> | RoadmapGoal
  onSave: (data: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
  onDelete?: () => void
  deleteConfirm?: boolean
  isEdit?: boolean
}

function GoalForm({ initial, onSave, onCancel, onDelete, deleteConfirm, isEdit }: GoalFormProps) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [category, setCategory] = useState<RoadmapGoalCategory>(initial.category)
  const [targetYear, setTargetYear] = useState(initial.targetYear)
  const [targetQuarter, setTargetQuarter] = useState<1 | 2 | 3 | 4>(initial.targetQuarter)
  const [priority, setPriority] = useState(initial.priority)
  const [status, setStatus] = useState<RoadmapGoalStatus>(initial.status)
  const [researchQuestions, setResearchQuestions] = useState<string[]>(initial.research_questions)
  const [guidanceNeeded, setGuidanceNeeded] = useState<string[]>(initial.guidance_needed)
  const [notes, setNotes] = useState(initial.notes)
  const [subGoals, setSubGoals] = useState<RoadmapSubGoal[]>(initial.sub_goals)
  const [tagsInput, setTagsInput] = useState(initial.tags.join(', '))

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description,
      category,
      targetQuarter,
      targetYear,
      priority,
      status,
      research_questions: researchQuestions.filter(q => q.trim()),
      guidance_needed: guidanceNeeded.filter(g => g.trim()),
      notes,
      sub_goals: subGoals.filter(s => s.title.trim()),
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  const curYear = new Date().getFullYear()

  return (
    <div className={`${isEdit ? 'p-3' : 'rounded-xl border border-white/[0.08] bg-surface-1/60 p-4 mb-4'} space-y-3`}>
      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Goal title..."
        className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-blue/40"
        autoFocus
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description..."
        rows={2}
        className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted focus:outline-none focus:border-accent-blue/40 resize-none"
      />

      {/* Category Pills */}
      <div>
        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Category</label>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                category === c.id ? 'text-white border-white/20' : 'text-muted border-transparent hover:text-white/70'
              }`}
              style={category === c.id ? { backgroundColor: c.color + '30', borderColor: c.color + '50' } : {}}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Year + Quarter + Priority + Status */}
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Year</label>
          <select
            value={targetYear}
            onChange={e => setTargetYear(Number(e.target.value))}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {[curYear, curYear + 1, curYear + 2, curYear + 3, curYear + 4].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Quarter</label>
          <select
            value={targetQuarter}
            onChange={e => setTargetQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {([1, 2, 3, 4] as const).map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as typeof priority)}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as RoadmapGoalStatus)}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Sub-goals */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-muted uppercase tracking-wider">Sub-goals</label>
          <button
            onClick={() => setSubGoals([...subGoals, { id: generateId(), title: '', status: 'not_started' }])}
            className="text-[10px] text-accent-blue hover:text-accent-blue/80"
          >+ Add</button>
        </div>
        {subGoals.map((sg, i) => (
          <div key={sg.id} className="flex items-center gap-1.5 mb-1">
            <select
              value={sg.status}
              onChange={e => {
                const updated = [...subGoals]
                updated[i] = { ...sg, status: e.target.value as RoadmapGoalStatus }
                setSubGoals(updated)
              }}
              className="bg-surface-3/50 border border-white/[0.06] rounded px-1 py-1 text-[10px] text-white focus:outline-none w-24"
            >
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input
              type="text"
              value={sg.title}
              onChange={e => {
                const updated = [...subGoals]
                updated[i] = { ...sg, title: e.target.value }
                setSubGoals(updated)
              }}
              placeholder="Sub-goal..."
              className="flex-1 bg-surface-3/50 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white placeholder:text-muted focus:outline-none"
            />
            <button
              onClick={() => setSubGoals(subGoals.filter((_, j) => j !== i))}
              className="text-muted hover:text-accent-red text-xs px-1"
            >×</button>
          </div>
        ))}
      </div>

      {/* Research Questions */}
      <DynamicList
        label="Research Questions"
        items={researchQuestions}
        onChange={setResearchQuestions}
        placeholder="What do you need researched?"
      />

      {/* Guidance Needed */}
      <DynamicList
        label="Guidance Needed"
        items={guidanceNeeded}
        onChange={setGuidanceNeeded}
        placeholder="What guidance do you need?"
      />

      {/* Notes */}
      <div>
        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted focus:outline-none resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Tags <span className="text-muted/50">(comma-separated)</span></label>
        <input
          type="text"
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="e.g. saas, marketing, q2-launch"
          className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-muted focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="px-3 py-1.5 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all disabled:opacity-30"
        >
          {isEdit ? 'Save' : 'Create Goal'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-muted text-xs font-medium hover:text-white/70 transition-all"
        >Cancel</button>
        {isEdit && onDelete && (
          <button
            onClick={onDelete}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              deleteConfirm
                ? 'bg-accent-red/20 text-accent-red'
                : 'text-muted hover:text-accent-red'
            }`}
          >{deleteConfirm ? 'Confirm Delete' : 'Delete'}</button>
        )}
      </div>
    </div>
  )
}

// ─── Dynamic List (for research questions / guidance) ───
function DynamicList({ label, items, onChange, placeholder }: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
        <button
          onClick={() => onChange([...items, ''])}
          className="text-[10px] text-accent-blue hover:text-accent-blue/80"
        >+ Add</button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1">
          <input
            type="text"
            value={item}
            onChange={e => {
              const updated = [...items]
              updated[i] = e.target.value
              onChange(updated)
            }}
            placeholder={placeholder}
            className="flex-1 bg-surface-3/50 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white placeholder:text-muted focus:outline-none"
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-muted hover:text-accent-red text-xs px-1"
          >×</button>
        </div>
      ))}
    </div>
  )
}
