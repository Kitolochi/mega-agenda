import { useState, useEffect } from 'react'
import { MorningBriefing as MorningBriefingType } from '../types'

export default function MorningBriefing() {
  const [briefing, setBriefing] = useState<MorningBriefingType | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]

    // Check if already dismissed or cached
    window.electronAPI.getMorningBriefing(today).then(existing => {
      if (existing?.dismissed) {
        setDismissed(true)
        setLoading(false)
        return
      }
      if (existing) {
        setBriefing(existing)
        setLoading(false)
        return
      }
      // Generate new briefing
      window.electronAPI.generateMorningBriefing().then(b => {
        setBriefing(b)
        setLoading(false)
      }).catch(() => setLoading(false))
    })
  }, [])

  const handleDismiss = async () => {
    if (briefing) {
      await window.electronAPI.dismissMorningBriefing(briefing.date)
    }
    setDismissed(true)
  }

  if (dismissed) return null

  if (loading) {
    return (
      <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
        <div className="h-[3px] bg-gradient-to-r from-accent-blue via-accent-purple to-accent-emerald" />
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded bg-surface-3 animate-pulse" />
            <div className="w-24 h-3 rounded bg-surface-3 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 rounded bg-surface-3 animate-pulse" />
            <div className="w-3/4 h-3 rounded bg-surface-3 animate-pulse" />
            <div className="w-5/6 h-3 rounded bg-surface-3 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!briefing) return null

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div className="h-[3px] bg-gradient-to-r from-accent-blue via-accent-purple to-accent-emerald" />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm">✨</span>
            <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Morning Briefing</span>
            {briefing.isAiEnhanced && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent-purple/15 text-accent-purple font-medium">AI</span>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted hover:text-white/60 transition-colors"
            title="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="text-xs text-white/70 leading-relaxed whitespace-pre-line">
          {briefing.content}
        </div>
      </div>
    </div>
  )
}
