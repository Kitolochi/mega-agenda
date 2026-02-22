import { useState, useEffect } from 'react'
import { RoadmapGoal } from '../../types'

interface ContextQuestionnaireProps {
  goals: RoadmapGoal[]
  onComplete: () => void
  onSkip: () => void
}

const categoryColors: Record<string, string> = {
  career: 'bg-blue-500/20 text-blue-400',
  health: 'bg-green-500/20 text-green-400',
  financial: 'bg-yellow-500/20 text-yellow-400',
  relationships: 'bg-pink-500/20 text-pink-400',
  learning: 'bg-purple-500/20 text-purple-400',
  projects: 'bg-cyan-500/20 text-cyan-400',
  personal: 'bg-orange-500/20 text-orange-400',
  creative: 'bg-indigo-500/20 text-indigo-400',
}

export default function ContextQuestionnaire({ goals, onComplete, onSkip }: ContextQuestionnaireProps) {
  const [questions, setQuestions] = useState<{ goalId: string; questions: string[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadQuestions()
  }, [])

  // Pre-fill existing personalContext
  useEffect(() => {
    const existing: Record<string, string> = {}
    for (const goal of goals) {
      if (goal.personalContext) {
        existing[goal.id] = goal.personalContext
      }
    }
    if (Object.keys(existing).length > 0) {
      setAnswers(existing)
    }
  }, [goals])

  const loadQuestions = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.generateContextQuestions()
      setQuestions(result)
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      // Save personalContext to each goal that has an answer
      for (const goal of goals) {
        const answer = answers[goal.id]
        if (answer && answer.trim()) {
          await window.electronAPI.updateRoadmapGoal(goal.id, { personalContext: answer.trim() })
        }
      }
      onComplete()
    } catch (err: any) {
      setError(err.message || 'Failed to save context')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mb-3" />
        <p className="text-white text-sm font-medium mb-1">Generating context questions...</p>
        <p className="text-muted text-xs">AI is crafting personalized questions for each goal</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h3 className="text-white font-display font-semibold text-base mb-1">Personalize Your Plan</h3>
        <p className="text-muted text-xs">Answer a few questions per goal so the AI can tailor your master plan. You can skip any.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {goals.map(goal => {
          const goalQuestions = questions.find(q => q.goalId === goal.id)
          return (
            <div key={goal.id} className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-white font-medium text-sm">{goal.title}</h4>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColors[goal.category] || 'bg-white/10 text-muted'}`}>
                  {goal.category}
                </span>
              </div>

              {goalQuestions?.questions.map((q, i) => (
                <label key={i} className="block mb-2 last:mb-0">
                  <span className="text-muted text-xs block mb-1">{q}</span>
                </label>
              ))}

              <textarea
                value={answers[goal.id] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [goal.id]: e.target.value }))}
                placeholder="Share your current situation, progress, budget, constraints..."
                className="w-full px-3 py-2 rounded-lg bg-surface-1 border border-border text-white text-xs placeholder-white/20 resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
                rows={3}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <button
          onClick={onSkip}
          className="px-3 py-1.5 rounded-lg text-muted text-xs hover:text-white hover:bg-white/5 transition-colors"
        >
          Skip & Generate Without Context
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all disabled:opacity-50"
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          )}
          Generate Master Plan
        </button>
      </div>
    </div>
  )
}
