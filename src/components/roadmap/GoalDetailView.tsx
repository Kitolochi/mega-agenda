import { useState, useEffect } from 'react'
import { RoadmapGoal, ContextFile } from '../../types'
import { CATEGORIES, catColor } from './constants'
import GoalForm from './GoalForm'

interface GoalDetailViewProps {
  goal: RoadmapGoal
  onUpdateGoal: (updates: Partial<RoadmapGoal>) => Promise<void>
  onDeleteGoal: () => Promise<void>
  onReload: () => void
  onBack: () => void
}

export default function GoalDetailView({ goal, onUpdateGoal, onDeleteGoal, onReload, onBack }: GoalDetailViewProps) {
  const [editing, setEditing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [researchingAll, setResearchingAll] = useState(false)
  const [researchingIdx, setResearchingIdx] = useState<string | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [findingTopics, setFindingTopics] = useState(false)
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [showContextPicker, setShowContextPicker] = useState(false)

  useEffect(() => {
    window.electronAPI.getContextFiles().then(setContextFiles).catch(() => {})
  }, [])

  const color = catColor(goal.category)
  const allTopics = [
    ...goal.research_questions.map((q, i) => ({ text: q, type: 'question' as const, index: i })),
    ...goal.guidance_needed.map((g, i) => ({ text: g, type: 'guidance' as const, index: i })),
  ]
  const totalTopics = allTopics.length
  const researchedCount = goal.topicReports?.length || 0

  const hasReport = (text: string, type: 'question' | 'guidance') =>
    goal.topicReports?.find(r => r.topic === text && r.type === type)

  const handleResearchAll = async () => {
    setResearchingAll(true)
    setError(null)
    try {
      await window.electronAPI.researchRoadmapGoal(goal.id)
      onReload()
    } catch (err: any) {
      setError(err.message || 'Research failed')
    } finally {
      setResearchingAll(false)
    }
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

  const handleFindTopics = async () => {
    setFindingTopics(true)
    setError(null)
    try {
      await window.electronAPI.generateTopics(goal.id)
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

      {/* Action buttons */}
      <div className="flex items-center gap-2 ml-7">
        <button
          onClick={handleFindTopics}
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
            {generatingPlan ? 'Generating...' : 'Get Best Steps'}
          </button>
        )}
      </div>

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

      {/* Topics with inline reports */}
      {allTopics.length > 0 && (
        <div className="ml-7 space-y-1.5">
          <h4 className="text-[10px] text-muted uppercase tracking-wider px-1 mb-2">Research Topics</h4>
          {allTopics.map((topic) => {
            const report = hasReport(topic.text, topic.type)
            const key = `${topic.type}-${topic.index}`
            const isExpanded = expandedTopic === key
            const isResearching = researchingIdx === key

            return (
              <div key={key} className="rounded-lg border border-white/[0.06] bg-surface-2/40 overflow-hidden">
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-surface-2/60 transition-all"
                  onClick={() => report ? setExpandedTopic(isExpanded ? null : key) : null}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${report ? 'bg-green-400' : 'bg-white/[0.15]'}`} />
                  <span className="text-xs text-white/80 flex-1">{topic.text}</span>
                  {!report && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleResearchTopic(topic.index, topic.type) }}
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
                        {new Date(report.generatedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleResearchTopic(topic.index, topic.type)}
                        disabled={isResearching}
                        className="text-[9px] text-muted hover:text-accent-purple transition-colors"
                      >Re-research</button>
                    </div>
                    <div className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed">{report.report}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalTopics === 0 && (
        <div className="ml-7 flex flex-col items-center py-10 text-center rounded-xl border border-white/[0.06] bg-surface-1/40">
          <p className="text-muted text-sm mb-2">No research topics yet</p>
          <p className="text-xs text-muted/60">Click "Find Topics" above to have AI generate research topics, or edit the goal manually.</p>
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
