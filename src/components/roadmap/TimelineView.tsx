import { RoadmapGoal } from '../../types'
import { CATEGORIES, PRIORITY_COLORS, catColor, currentQuarter } from './constants'

interface TimelineViewProps {
  goals: RoadmapGoal[]
  onDrillToTopics: (goalId: string) => void
}

export default function TimelineView({ goals, onDrillToTopics }: TimelineViewProps) {
  const cur = currentQuarter()
  const years = [...new Set(goals.map(g => g.targetYear))].sort()
  const qLabels = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec']

  if (goals.length === 0) return null

  return (
    <div className="space-y-8">
      {years.map(year => {
        const yearGoals = goals.filter(g => g.targetYear === year)
        return (
          <div key={year}>
            {/* Year label */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-lg font-display font-bold text-white/80">{year}</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[10px] text-muted">{yearGoals.length} goal{yearGoals.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Horizontal timeline line */}
            <div className="relative mb-4">
              <div className="flex items-center">
                {([1, 2, 3, 4] as const).map((q, qi) => {
                  const isCurrent = year === cur.y && q === cur.q
                  return (
                    <div key={q} className="flex-1 flex items-center">
                      {/* Quarter dot */}
                      <div className="relative z-10">
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          isCurrent
                            ? 'bg-accent-blue border-accent-blue shadow-[0_0_8px_rgba(96,165,250,0.5)]'
                            : 'bg-surface-2 border-white/20'
                        }`} />
                        <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold whitespace-nowrap ${
                          isCurrent ? 'text-accent-blue' : 'text-muted'
                        }`}>
                          Q{q}
                        </span>
                      </div>
                      {/* Line segment */}
                      {qi < 3 && (
                        <div className={`flex-1 h-0.5 ${
                          isCurrent ? 'bg-accent-blue/30' : 'bg-white/[0.08]'
                        }`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quarter columns with goal nodes */}
            <div className="grid grid-cols-4 gap-3 mt-8">
              {([1, 2, 3, 4] as const).map(q => {
                const qGoals = yearGoals.filter(g => g.targetQuarter === q)
                const isCurrent = year === cur.y && q === cur.q
                return (
                  <div key={q} className="min-h-[60px]">
                    <div className={`text-[9px] font-medium mb-2 ${isCurrent ? 'text-accent-blue/70' : 'text-muted/50'}`}>
                      {qLabels[q - 1]}
                      {isCurrent && <span className="ml-1.5 text-[8px] bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded-full font-semibold">NOW</span>}
                    </div>
                    <div className="space-y-2">
                      {qGoals.map(g => {
                        const color = catColor(g.category)
                        const totalTopics = g.research_questions.length + g.guidance_needed.length
                        const researchedCount = g.topicReports?.length || 0
                        return (
                          <button
                            key={g.id}
                            onClick={() => onDrillToTopics(g.id)}
                            className="w-full text-left rounded-lg border border-white/[0.06] bg-surface-2/60 hover:bg-surface-2/80 hover:border-white/[0.12] transition-all group overflow-hidden"
                            style={{ borderLeftWidth: 3, borderLeftColor: color }}
                          >
                            <div className="px-2.5 py-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[g.priority] }} />
                                <span className="text-[11px] font-medium text-white/90 truncate flex-1">{g.title || 'Untitled'}</span>
                                <svg className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '20', color }}>
                                  {CATEGORIES.find(c => c.id === g.category)?.label || g.category}
                                </span>
                                {totalTopics > 0 && (
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                    researchedCount === totalTopics
                                      ? 'bg-green-500/15 text-green-400'
                                      : 'bg-white/[0.06] text-muted'
                                  }`}>
                                    {researchedCount}/{totalTopics} researched
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                      {qGoals.length === 0 && (
                        <p className="text-[9px] text-muted/30 text-center py-3">—</p>
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
  )
}
