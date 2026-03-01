import { useState } from 'react'
import { RoadmapGoal } from '../../types'

interface TopicReportViewProps {
  goal: RoadmapGoal
  topicIndex: number
  topicType: 'question' | 'guidance'
  onBack?: () => void
  onReload: () => void
}

export default function TopicReportView({ goal, topicIndex, topicType, onReload }: TopicReportViewProps) {
  const [researching, setResearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = topicType === 'question' ? goal.research_questions : goal.guidance_needed
  const topicText = items[topicIndex]

  const report = goal.topicReports?.find(r => r.topic === topicText && r.type === topicType)

  const handleResearch = async () => {
    setResearching(true)
    setError(null)
    try {
      await window.electronAPI.researchRoadmapTopic(goal.id, topicIndex, topicType)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Research failed')
    } finally {
      setResearching(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Topic header */}
      <div className="rounded-xl border border-white/[0.06] bg-surface-1/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
            topicType === 'question'
              ? 'bg-accent-blue/20 text-accent-blue'
              : 'bg-accent-purple/20 text-accent-purple'
          }`}>
            {topicType === 'question' ? 'Research Question' : 'Guidance Need'}
          </span>
          <span className="text-[10px] text-muted">from {goal.title}</span>
        </div>
        <p className="text-sm text-white/90 font-medium">{topicText}</p>
      </div>

      {/* Report content or empty state */}
      {report ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-1/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-accent-purple font-semibold uppercase tracking-wider">Research Report</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue font-medium">
                {report.model || 'claude (legacy)'}
              </span>
              <span className="text-[10px] text-muted">
                {new Date(report.generatedAt).toLocaleDateString()} {new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={handleResearch}
                disabled={researching}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.06] text-muted text-[9px] font-medium hover:bg-white/[0.1] hover:text-white/70 transition-all disabled:opacity-50"
              >
                {researching ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                )}
                Re-research
              </button>
            </div>
          </div>
          <div className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed">{report.report}</div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-white/[0.06] bg-surface-1/60">
          <svg className="w-10 h-10 text-muted mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-muted text-sm mb-3">No research report yet</p>
          <button
            onClick={handleResearch}
            disabled={researching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-purple/20 text-accent-purple text-xs font-medium hover:bg-accent-purple/30 transition-all disabled:opacity-50"
          >
            {researching ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Researching...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Research this topic
              </>
            )}
          </button>
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
