import { useState } from 'react'
import { RoadmapGoal } from '../../types'
import { catColor, statusIcon } from './constants'
import GoalForm from './GoalForm'

interface TopicListViewProps {
  goal: RoadmapGoal
  onDrillToReport: (topicIndex: number, topicType: 'question' | 'guidance') => void
  onUpdateGoal: (updates: Partial<RoadmapGoal>) => Promise<void>
  onDeleteGoal: () => Promise<void>
  onReload: () => void
}

export default function TopicListView({ goal, onDrillToReport, onUpdateGoal, onDeleteGoal, onReload }: TopicListViewProps) {
  const [editing, setEditing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [researchingIdx, setResearchingIdx] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const color = catColor(goal.category)
  const totalTopics = goal.research_questions.length + goal.guidance_needed.length
  const researchedCount = goal.topicReports?.length || 0

  const handleResearch = async (topicIndex: number, topicType: 'question' | 'guidance') => {
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

  const hasReport = (topicText: string, type: 'question' | 'guidance') => {
    return goal.topicReports?.some(r => r.topic === topicText && r.type === type)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-surface-1/60 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
          <span className="text-sm font-semibold text-white/90 flex-1">{goal.title}</span>
          <button onClick={() => setEditing(false)} className="text-muted hover:text-white/60 text-xs">Close</button>
        </div>
        <GoalForm
          initial={goal}
          onSave={async (data) => {
            await onUpdateGoal(data)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          onDelete={async () => {
            if (deleteConfirm) {
              await onDeleteGoal()
            } else {
              setDeleteConfirm(true)
            }
          }}
          deleteConfirm={deleteConfirm}
          isEdit
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Goal header card */}
      <div className="rounded-xl border border-white/[0.06] bg-surface-1/60 p-4" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-white/90 mb-1">{goal.title}</h3>
            {goal.description && <p className="text-xs text-muted leading-relaxed">{goal.description}</p>}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.06] text-muted text-[10px] font-medium hover:bg-white/[0.1] hover:text-white/70 transition-all flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '20', color }}>
            {goal.category}
          </span>
          <span className="text-[9px] text-muted">Q{goal.targetQuarter} {goal.targetYear}</span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
            goal.status === 'in_progress' ? 'bg-accent-blue/20 text-accent-blue' :
            goal.status === 'completed' ? 'bg-green-500/20 text-green-400' :
            goal.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-white/[0.06] text-muted'
          }`}>
            [{statusIcon(goal.status)}] {goal.status.replace('_', ' ')}
          </span>
          {totalTopics > 0 && (
            <span className="text-[9px] text-muted">{researchedCount}/{totalTopics} researched</span>
          )}
        </div>
      </div>

      {/* Topic cards */}
      {goal.research_questions.length > 0 && (
        <div>
          <h4 className="text-[10px] text-muted uppercase tracking-wider mb-2 px-1">Research Questions</h4>
          <div className="space-y-2">
            {goal.research_questions.map((q, i) => {
              const researched = hasReport(q, 'question')
              const isResearching = researchingIdx === `question-${i}`
              return (
                <div key={i} className="rounded-lg border border-white/[0.06] bg-surface-2/60 p-3 hover:bg-surface-2/80 transition-all">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${researched ? 'bg-green-400' : 'bg-white/[0.15]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-accent-blue/15 text-accent-blue">Research</span>
                      </div>
                      <p className="text-xs text-white/80 mb-2">{q}</p>
                      <div className="flex items-center gap-2">
                        {researched && (
                          <button
                            onClick={() => onDrillToReport(i, 'question')}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-emerald/15 text-accent-emerald text-[9px] font-medium hover:bg-accent-emerald/25 transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            View Report
                          </button>
                        )}
                        <button
                          onClick={() => handleResearch(i, 'question')}
                          disabled={isResearching}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-purple/15 text-accent-purple text-[9px] font-medium hover:bg-accent-purple/25 transition-all disabled:opacity-50"
                        >
                          {isResearching ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          )}
                          {isResearching ? 'Researching...' : researched ? 'Re-research' : 'Research'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {goal.guidance_needed.length > 0 && (
        <div>
          <h4 className="text-[10px] text-muted uppercase tracking-wider mb-2 px-1">Guidance Needed</h4>
          <div className="space-y-2">
            {goal.guidance_needed.map((g, i) => {
              const researched = hasReport(g, 'guidance')
              const isResearching = researchingIdx === `guidance-${i}`
              return (
                <div key={i} className="rounded-lg border border-white/[0.06] bg-surface-2/60 p-3 hover:bg-surface-2/80 transition-all">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${researched ? 'bg-green-400' : 'bg-white/[0.15]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-accent-purple/15 text-accent-purple">Guidance</span>
                      </div>
                      <p className="text-xs text-white/80 mb-2">{g}</p>
                      <div className="flex items-center gap-2">
                        {researched && (
                          <button
                            onClick={() => onDrillToReport(i, 'guidance')}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-emerald/15 text-accent-emerald text-[9px] font-medium hover:bg-accent-emerald/25 transition-all"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            View Report
                          </button>
                        )}
                        <button
                          onClick={() => handleResearch(i, 'guidance')}
                          disabled={isResearching}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent-purple/15 text-accent-purple text-[9px] font-medium hover:bg-accent-purple/25 transition-all disabled:opacity-50"
                        >
                          {isResearching ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          )}
                          {isResearching ? 'Researching...' : researched ? 'Re-research' : 'Research'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalTopics === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-white/[0.06] bg-surface-1/60">
          <p className="text-muted text-sm mb-2">No research topics defined</p>
          <p className="text-muted/60 text-xs">Edit this goal to add research questions or guidance needs</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-3 py-2 text-xs text-accent-red">
          {error}
        </div>
      )}
    </div>
  )
}
