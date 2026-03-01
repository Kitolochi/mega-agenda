import { useState, useEffect } from 'react'
import { ActivityEntry } from '../types'

export default function ActivityHeatmap() {
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [tooltip, setTooltip] = useState<{ date: string; tasks: number; focus: number; x: number; y: number } | null>(null)

  useEffect(() => {
    window.electronAPI.getActivityLog(90).then(setActivityLog)
  }, [])

  const getIntensity = (entry?: ActivityEntry): number => {
    if (!entry) return 0
    const score = entry.tasksCompleted + Math.floor(entry.focusMinutes / 25)
    if (score === 0) return 0
    if (score <= 1) return 1
    if (score <= 3) return 2
    if (score <= 5) return 3
    return 4
  }

  const intensityColors = [
    'bg-white/[0.04]',
    'bg-emerald-900/60',
    'bg-emerald-700/60',
    'bg-emerald-500/60',
    'bg-emerald-400/70',
  ]

  // Build 90-day grid (13 weeks x 7 days)
  const today = new Date()
  const days: { date: string; entry?: ActivityEntry }[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({ date: dateStr, entry: activityLog.find(e => e.date === dateStr) })
  }

  // Pad to start on Sunday
  const firstDate = new Date(days[0].date + 'T00:00:00')
  const padDays = firstDate.getDay()
  const paddedDays: (typeof days[0] | null)[] = Array(padDays).fill(null).concat(days)

  // Split into weeks (columns)
  const weeks: (typeof paddedDays)[] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }
  // Pad last week to 7 days
  while (weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null)
  }

  const activeDays = days.filter(d => d.entry && (d.entry.tasksCompleted > 0 || d.entry.focusMinutes > 0)).length

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="glass-card rounded-xl p-3 relative hover-lift">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Activity</span>
          <span className="text-[10px] text-white/40">{activeDays} active days</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted/50">Less</span>
          {intensityColors.map((color, i) => (
            <div key={i} className={`w-2 h-2 rounded-sm ${color}`} />
          ))}
          <span className="text-[9px] text-muted/50">More</span>
        </div>
      </div>

      <div className="flex gap-[3px] overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="w-[10px] h-[10px]" />
              const intensity = getIntensity(day.entry)
              return (
                <div
                  key={di}
                  className={`w-[10px] h-[10px] rounded-sm ${intensityColors[intensity]} cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-white/20 hover:scale-150 hover:z-10`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({
                      date: day.date,
                      tasks: day.entry?.tasksCompleted || 0,
                      focus: day.entry?.focusMinutes || 0,
                      x: rect.left + rect.width / 2,
                      y: rect.top
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-2 rounded-xl bg-surface-4 border border-white/[0.08] shadow-2xl shadow-black/40 pointer-events-none animate-scale-in"
          style={{ left: tooltip.x, top: tooltip.y - 44, transform: 'translateX(-50%)' }}
        >
          <p className="text-[10px] text-white/80 font-medium">{formatDate(tooltip.date)}</p>
          <p className="text-[9px] text-muted">
            {tooltip.tasks} task{tooltip.tasks !== 1 ? 's' : ''}
            {tooltip.focus > 0 ? ` · ${tooltip.focus}m focus` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
