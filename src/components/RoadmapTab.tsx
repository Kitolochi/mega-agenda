import { useState, useEffect, useCallback } from 'react'
import { RoadmapGoal, RoadmapGoalCategory, RoadmapGoalStatus } from '../types'
import { CATEGORIES, STATUSES, emptyGoal } from './roadmap/constants'
import GoalForm from './roadmap/GoalForm'
import TimelineView from './roadmap/TimelineView'
import TopicListView from './roadmap/TopicListView'
import TopicReportView from './roadmap/TopicReportView'

type DrillState =
  | { level: 'timeline' }
  | { level: 'topics'; goalId: string }
  | { level: 'report'; goalId: string; topicIndex: number; topicType: 'question' | 'guidance' }

export default function RoadmapTab() {
  const [goals, setGoals] = useState<RoadmapGoal[]>([])
  const [drill, setDrill] = useState<DrillState>({ level: 'timeline' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState<RoadmapGoalCategory | null>(null)
  const [filterStatus, setFilterStatus] = useState<RoadmapGoalStatus | null>(null)

  const loadGoals = useCallback(async () => {
    const data = await window.electronAPI.getRoadmapGoals()
    setGoals(data)
  }, [])

  useEffect(() => { loadGoals() }, [loadGoals])

  // Escape key to go back one level
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drill.level === 'report') {
          setDrill({ level: 'topics', goalId: drill.goalId })
        } else if (drill.level === 'topics') {
          setDrill({ level: 'timeline' })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drill])

  const filtered = goals.filter(g => {
    if (filterCategory && g.category !== filterCategory) return false
    if (filterStatus && g.status !== filterStatus) return false
    return true
  })

  const inProgressCount = goals.filter(g => g.status === 'in_progress').length
  const activeGoal = drill.level !== 'timeline' ? goals.find(g => g.id === drill.goalId) : null

  // If drilled into a goal that no longer exists, go back
  useEffect(() => {
    if (drill.level !== 'timeline' && !goals.find(g => g.id === (drill as any).goalId)) {
      setDrill({ level: 'timeline' })
    }
  }, [goals, drill])

  const getTopicText = () => {
    if (drill.level !== 'report' || !activeGoal) return ''
    const items = drill.topicType === 'question' ? activeGoal.research_questions : activeGoal.guidance_needed
    return items[drill.topicIndex] || ''
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb (Levels 2 & 3) */}
      {drill.level !== 'timeline' && (
        <div className="flex items-center gap-1.5 mb-4 text-[11px]">
          <button onClick={() => setDrill({ level: 'timeline' })} className="text-accent-blue hover:text-accent-blue/80 font-medium transition-colors">
            Timeline
          </button>
          <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          {drill.level === 'topics' && (
            <span className="text-white/70 font-medium truncate">{activeGoal?.title}</span>
          )}
          {drill.level === 'report' && (
            <>
              <button
                onClick={() => setDrill({ level: 'topics', goalId: drill.goalId })}
                className="text-accent-blue hover:text-accent-blue/80 font-medium transition-colors truncate max-w-[200px]"
              >
                {activeGoal?.title}
              </button>
              <svg className="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70 font-medium truncate max-w-[250px]">{getTopicText()}</span>
            </>
          )}
        </div>
      )}

      {/* Header (Level 1 only) */}
      {drill.level === 'timeline' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <h2 className="text-lg font-display font-semibold text-white">Roadmap</h2>
              <span className="text-xs text-muted">{goals.length} goal{goals.length !== 1 ? 's' : ''} · {inProgressCount} in progress</span>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Goal
            </button>
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
        </>
      )}

      {/* Level 1: Timeline */}
      {drill.level === 'timeline' && filtered.length > 0 && (
        <TimelineView
          goals={filtered}
          onDrillToTopics={(goalId) => setDrill({ level: 'topics', goalId })}
        />
      )}

      {/* Level 2: Topics */}
      {drill.level === 'topics' && activeGoal && (
        <TopicListView
          goal={activeGoal}
          onDrillToReport={(topicIndex, topicType) =>
            setDrill({ level: 'report', goalId: drill.goalId, topicIndex, topicType })
          }
          onUpdateGoal={async (updates) => {
            await window.electronAPI.updateRoadmapGoal(drill.goalId, updates)
            loadGoals()
          }}
          onDeleteGoal={async () => {
            await window.electronAPI.deleteRoadmapGoal(drill.goalId)
            setDrill({ level: 'timeline' })
            loadGoals()
          }}
          onReload={loadGoals}
        />
      )}

      {/* Level 3: Report */}
      {drill.level === 'report' && activeGoal && (
        <TopicReportView
          goal={activeGoal}
          topicIndex={drill.topicIndex}
          topicType={drill.topicType}
          onBack={() => setDrill({ level: 'topics', goalId: drill.goalId })}
          onReload={loadGoals}
        />
      )}
    </div>
  )
}
