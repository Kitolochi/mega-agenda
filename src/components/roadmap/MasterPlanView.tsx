import { useState, useEffect } from 'react'
import { MasterPlan, RoadmapGoal } from '../../types'
import ContextQuestionnaire from './ContextQuestionnaire'
import ExecutionDashboard from './ExecutionDashboard'

interface MasterPlanViewProps {
  onBack: () => void
}

type Tab = 'plan' | 'execution'

export default function MasterPlanView({ onBack }: MasterPlanViewProps) {
  const [plan, setPlan] = useState<MasterPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('plan')
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [goals, setGoals] = useState<RoadmapGoal[]>([])

  useEffect(() => {
    loadPlan()
    loadGoals()
  }, [])

  const loadPlan = async () => {
    setLoading(true)
    try {
      const existing = await window.electronAPI.getMasterPlan()
      setPlan(existing)
    } catch (err: any) {
      setError(err.message || 'Failed to load master plan')
    } finally {
      setLoading(false)
    }
  }

  const loadGoals = async () => {
    try {
      const all = await window.electronAPI.getRoadmapGoals()
      setGoals(all.filter(g => (g.topicReports || []).length > 0))
    } catch {}
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const result = await window.electronAPI.generateMasterPlan()
      setPlan(result)
      setShowQuestionnaire(false)
    } catch (err: any) {
      setError(err.message || 'Failed to generate master plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateClick = () => {
    handleGenerate()  // Skip questionnaire, go directly to generation
  }

  const handleQuestionnaireComplete = () => {
    setShowQuestionnaire(false)
    handleGenerate()
  }

  const handleQuestionnaireSkip = () => {
    setShowQuestionnaire(false)
    handleGenerate()
  }

  const handleViewSession = (sessionId: string) => {
    // Navigate to CLI session viewer - for now, copy sessionId to clipboard
    window.electronAPI.writeClipboard(sessionId)
  }

  const planDate = plan ? plan.generatedAt.split('T')[0] : new Date().toISOString().split('T')[0]

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin mb-3" />
        <p className="text-muted text-xs">Loading master plan...</p>
      </div>
    )
  }

  // Questionnaire view
  if (showQuestionnaire) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setShowQuestionnaire(false)}
            className="p-1 rounded hover:bg-white/5 text-muted hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-display font-semibold text-white">Master Plan</h2>
        </div>
        <ContextQuestionnaire
          goals={goals}
          onComplete={handleQuestionnaireComplete}
          onSkip={handleQuestionnaireSkip}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 rounded hover:bg-white/5 text-muted hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-display font-semibold text-white">Master Plan</h2>
        </div>
        <div className="flex items-center gap-2">
          {plan && (
            <button
              onClick={handleGenerateClick}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-all disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      {plan && (
        <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-surface-1 w-fit">
          <button
            onClick={() => setTab('plan')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === 'plan'
                ? 'bg-white/10 text-white'
                : 'text-muted hover:text-white'
            }`}
          >
            Plan
          </button>
          <button
            onClick={() => setTab('execution')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === 'execution'
                ? 'bg-white/10 text-white'
                : 'text-muted hover:text-white'
            }`}
          >
            Execution
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Generating spinner */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mb-4" />
          <p className="text-white text-sm font-medium mb-1">Generating Master Plan...</p>
          <p className="text-muted text-xs">Synthesizing all goals, research & action plans</p>
          <p className="text-muted text-xs mt-1">This may take a minute or two</p>
        </div>
      )}

      {/* Empty state — no plan yet */}
      {!generating && !plan && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a9 9 0 11-18 0V5.25" />
            </svg>
          </div>
          <p className="text-white text-sm font-medium mb-1">No Master Plan yet</p>
          <p className="text-muted text-xs mb-5 max-w-xs">
            Generate a cross-goal synthesis that analyzes all your researched goals together — finding synergies, conflicts, and building a prioritized execution roadmap.
          </p>
          <button
            onClick={handleGenerateClick}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            Generate Master Plan
          </button>
        </div>
      )}

      {/* Plan tab content */}
      {!generating && plan && tab === 'plan' && (
        <div>
          {/* Meta info */}
          <div className="flex items-center gap-3 mb-4 text-xs text-muted">
            <span>Generated {new Date(plan.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            <span className="text-white/10">|</span>
            <span>{plan.metadata.goalsWithResearch} of {plan.metadata.totalGoals} goals analyzed</span>
          </div>

          {/* Plan body */}
          <div className="rounded-xl bg-card border border-border p-5">
            <div className="prose prose-invert prose-sm max-w-none text-sm text-gray-300 leading-relaxed">
              {plan.content.split('\n').map((line, i) => {
                // Section headers (## )
                if (line.startsWith('## ')) {
                  return (
                    <h2 key={i} className="text-white font-display font-semibold text-base mt-6 mb-3 first:mt-0 border-b border-border pb-2">
                      {line.replace(/^##\s*/, '')}
                    </h2>
                  )
                }
                // Sub-headers (### )
                if (line.startsWith('### ')) {
                  return (
                    <h3 key={i} className="text-white font-medium text-sm mt-4 mb-2">
                      {line.replace(/^###\s*/, '')}
                    </h3>
                  )
                }
                // Bold lines (** **)
                if (line.startsWith('**') && line.endsWith('**')) {
                  return (
                    <p key={i} className="text-white font-medium mt-3 mb-1">
                      {line.replace(/\*\*/g, '')}
                    </p>
                  )
                }
                // List items
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  const content = line.replace(/^[-*]\s+/, '')
                  return (
                    <div key={i} className="flex gap-2 ml-1 mb-1">
                      <span className="text-muted mt-0.5 shrink-0">-</span>
                      <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
                    </div>
                  )
                }
                // Numbered items
                if (/^\d+\.\s/.test(line)) {
                  const match = line.match(/^(\d+)\.\s(.*)/)
                  if (match) {
                    return (
                      <div key={i} className="flex gap-2 ml-1 mb-1">
                        <span className="text-muted shrink-0">{match[1]}.</span>
                        <span dangerouslySetInnerHTML={{ __html: formatInline(match[2]) }} />
                      </div>
                    )
                  }
                }
                // Empty lines
                if (line.trim() === '') {
                  return <div key={i} className="h-2" />
                }
                // Regular text
                return (
                  <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Execution tab content */}
      {!generating && plan && tab === 'execution' && (
        <ExecutionDashboard
          planDate={planDate}
          onViewSession={handleViewSession}
        />
      )}
    </div>
  )
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-medium">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-white/5 text-purple-300 text-xs">$1</code>')
}
