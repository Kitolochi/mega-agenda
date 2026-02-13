import { useState, useEffect, useCallback } from 'react'
import { WeeklyReview as WeeklyReviewType } from '../types'

export default function WeeklyReview() {
  const [reviews, setReviews] = useState<WeeklyReviewType[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reviewNeeded, setReviewNeeded] = useState<{ needed: boolean; weekStart: string } | null>(null)

  const loadData = useCallback(async () => {
    const [allReviews, needed] = await Promise.all([
      window.electronAPI.getAllWeeklyReviews(),
      window.electronAPI.checkWeeklyReviewNeeded()
    ])
    setReviews(allReviews)
    setReviewNeeded(needed)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleGenerate = async (weekStart: string) => {
    setGenerating(true)
    try {
      await window.electronAPI.generateWeeklyReview(weekStart)
      await loadData()
      setExpanded(weekStart)
    } catch (err) {
      console.error('Failed to generate review:', err)
    }
    setGenerating(false)
  }

  const formatWeekRange = (weekStart: string) => {
    const start = new Date(weekStart + 'T00:00:00')
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', opts)} — ${end.toLocaleDateString('en-US', opts)}`
  }

  // Get recent week starts for generation (last 4 weeks)
  const getRecentWeekStarts = (): string[] => {
    const weeks: string[] = []
    const now = new Date()
    for (let i = 0; i < 4; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) - (i * 7))
      weeks.push(d.toISOString().split('T')[0])
    }
    return weeks
  }

  const recentWeeks = getRecentWeekStarts()
  const unreviewedWeeks = recentWeeks.filter(w => !reviews.find(r => r.weekStartDate === w))

  return (
    <div className="h-full flex flex-col p-4 animate-fade-in">
      {/* Sunday prompt banner */}
      {reviewNeeded?.needed && !reviews.find(r => r.weekStartDate === reviewNeeded.weekStart) && (
        <div className="mb-4 glass-card rounded-xl overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-accent-amber to-accent-orange" />
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📊</span>
              <div>
                <p className="text-xs text-white/80 font-medium">Time for your weekly review!</p>
                <p className="text-[10px] text-muted">Reflect on your progress this week</p>
              </div>
            </div>
            <button
              onClick={() => handleGenerate(reviewNeeded.weekStart)}
              disabled={generating}
              className="px-3 py-1.5 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-[11px] text-accent-blue font-medium transition-all"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Generate for past weeks */}
      {unreviewedWeeks.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Generate Review</p>
          <div className="flex flex-wrap gap-1.5">
            {unreviewedWeeks.map(week => (
              <button
                key={week}
                onClick={() => handleGenerate(week)}
                disabled={generating}
                className="px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-30 rounded-lg text-[10px] text-white/60 transition-all"
              >
                {formatWeekRange(week)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="flex-1 space-y-2 overflow-auto">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-surface-2 flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <p className="text-xs text-muted mb-1">No weekly reviews yet</p>
            <p className="text-[10px] text-muted/60">Generate your first review above</p>
          </div>
        ) : (
          reviews.map(review => {
            const isExpanded = expanded === review.weekStartDate
            return (
              <div key={review.weekStartDate} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : review.weekStartDate)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-all"
                >
                  <div>
                    <p className="text-xs text-white/80 font-medium">{formatWeekRange(review.weekStartDate)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted">
                        {review.tasksCompletedCount} task{review.tasksCompletedCount !== 1 ? 's' : ''}
                      </span>
                      {review.categoriesWorked.length > 0 && (
                        <span className="text-[10px] text-muted">
                          {review.categoriesWorked.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/[0.04]">
                    <div className="pt-3 text-xs text-white/70 leading-relaxed whitespace-pre-line prose-sm">
                      {review.content}
                    </div>
                    <p className="mt-2 text-[9px] text-muted/40">
                      Generated {new Date(review.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
