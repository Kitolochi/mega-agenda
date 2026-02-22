import { useState } from 'react'
import { RoadmapGoal } from '../../types'
import { CATEGORIES, PRIORITY_COLORS, catColor, statusIcon } from './constants'

interface TimelineViewProps {
  goals: RoadmapGoal[]
  onDrillToTopics: (goalId: string) => void
}

export default function TimelineView({ goals, onDrillToTopics }: TimelineViewProps) {
  const [researchingGoalId, setResearchingGoalId] = useState<string | null>(null)
  const [findingTopicsId, setFindingTopicsId] = useState<string | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)

  if (goals.length === 0) return null

  const handleFindTopics = async (e: React.MouseEvent, goal: RoadmapGoal) => {
    e.stopPropagation()
    setFindingTopicsId(goal.id)
    setResearchError(null)
    try {
      await window.electronAPI.generateTopics(goal.id)
      onDrillToTopics(goal.id)
    } catch (err: any) {
      setResearchError(err.message || 'Failed to find topics')
    } finally {
      setFindingTopicsId(null)
    }
  }

  const handleResearchAll = async (e: React.MouseEvent, goal: RoadmapGoal) => {
    e.stopPropagation()
    setResearchingGoalId(goal.id)
    setResearchError(null)
    try {
      await window.electronAPI.researchRoadmapGoal(goal.id)
      onDrillToTopics(goal.id)
    } catch (err: any) {
      setResearchError(err.message || 'Research failed')
    } finally {
      setResearchingGoalId(null)
    }
  }

  return (
    <div className="space-y-2">
      {goals.map(g => {
        const color = catColor(g.category)
        const totalTopics = g.research_questions.length + g.guidance_needed.length
        const researchedCount = g.topicReports?.length || 0
        const isResearching = researchingGoalId === g.id
        const statusLabel = g.status.replace('_', ' ')

        return (
          <button
            key={g.id}
            onClick={() => onDrillToTopics(g.id)}
            className="w-full text-left rounded-lg border border-white/[0.06] bg-surface-2/60 hover:bg-surface-2/80 hover:border-white/[0.12] transition-all group"
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <div className="px-4 py-3">
              {/* Title row */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[g.priority] }} />
                <span className="text-sm font-medium text-white/90 flex-1 truncate">{g.title || 'Untitled'}</span>
                <svg className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Description */}
              {g.description && (
                <p className="text-xs text-muted mb-2 pl-4">{g.description}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap pl-4">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '20', color }}>
                  {CATEGORIES.find(c => c.id === g.category)?.label || g.category}
                </span>
                <span className="text-[9px] text-muted">Q{g.targetQuarter} {g.targetYear}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  g.status === 'in_progress' ? 'bg-accent-blue/20 text-accent-blue' :
                  g.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  g.status === 'on_hold' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-white/[0.06] text-muted'
                }`}>
                  {statusLabel}
                </span>
                {totalTopics > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    researchedCount === totalTopics
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-white/[0.06] text-muted'
                  }`}>
                    {researchedCount}/{totalTopics} researched
                  </span>
                )}

                {/* Find Topics + Research All buttons */}
                <div className="ml-auto flex items-center gap-1.5">
                  <div
                    onClick={(e) => handleFindTopics(e, g)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                      findingTopicsId === g.id
                        ? 'bg-accent-blue/20 text-accent-blue/70'
                        : 'bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25'
                    }`}
                  >
                    {findingTopicsId === g.id ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    )}
                    {findingTopicsId === g.id ? 'Finding...' : 'Find Topics'}
                  </div>
                  {totalTopics > 0 && (
                    <div
                      onClick={(e) => handleResearchAll(e, g)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                        isResearching
                          ? 'bg-accent-purple/20 text-accent-purple/70'
                          : 'bg-accent-purple/15 text-accent-purple hover:bg-accent-purple/25'
                      }`}
                    >
                      {isResearching ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      )}
                      {isResearching ? 'Researching...' : 'Research All'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        )
      })}

      {researchError && (
        <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-3 py-2 text-xs text-accent-red">
          {researchError}
        </div>
      )}
    </div>
  )
}
