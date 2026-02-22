import { useState, useEffect, useCallback } from 'react'
import { RoadmapGoal } from '../types'
import { CATEGORIES, emptyGoal } from './roadmap/constants'
import GoalForm from './roadmap/GoalForm'
import TimelineView from './roadmap/TimelineView'
import GoalDetailView from './roadmap/GoalDetailView'
import MasterPlanView from './roadmap/MasterPlanView'

export default function RoadmapTab() {
  const [goals, setGoals] = useState<RoadmapGoal[]>([])
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showMasterPlan, setShowMasterPlan] = useState(false)

  const loadGoals = useCallback(async () => {
    const data = await window.electronAPI.getRoadmapGoals()
    setGoals(data)
  }, [])

  useEffect(() => { loadGoals() }, [loadGoals])

  // Escape to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeGoalId) setActiveGoalId(null)
        else if (showMasterPlan) setShowMasterPlan(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeGoalId, showMasterPlan])

  const activeGoal = activeGoalId ? goals.find(g => g.id === activeGoalId) : null

  // If drilled into a deleted goal, go back
  useEffect(() => {
    if (activeGoalId && !goals.find(g => g.id === activeGoalId)) {
      setActiveGoalId(null)
    }
  }, [goals, activeGoalId])

  // Master Plan view
  if (showMasterPlan) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <MasterPlanView onBack={() => setShowMasterPlan(false)} />
      </div>
    )
  }

  // Detail view
  if (activeGoal) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <GoalDetailView
          goal={activeGoal}
          onUpdateGoal={async (updates) => {
            await window.electronAPI.updateRoadmapGoal(activeGoal.id, updates)
            loadGoals()
          }}
          onDeleteGoal={async () => {
            await window.electronAPI.deleteRoadmapGoal(activeGoal.id)
            setActiveGoalId(null)
            loadGoals()
          }}
          onReload={loadGoals}
          onBack={() => setActiveGoalId(null)}
        />
      </div>
    )
  }

  // Goals list view
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-display font-semibold text-white">Goals</h2>
          <span className="text-xs text-muted">{goals.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMasterPlan(true)}
            disabled={!goals.some(g => (g.topicReports || []).length > 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title={goals.some(g => (g.topicReports || []).length > 0) ? 'View cross-goal master plan' : 'Research at least one goal first'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            Master Plan
          </button>
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
      </div>

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

      {!showAddForm && goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted text-sm mb-3">No goals yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all"
          >Add your first goal</button>
        </div>
      )}

      {goals.length > 0 && (
        <TimelineView
          goals={goals}
          onDrillToTopics={(goalId) => setActiveGoalId(goalId)}
        />
      )}
    </div>
  )
}
