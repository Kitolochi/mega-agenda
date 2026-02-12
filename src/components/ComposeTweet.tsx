import { useState } from 'react'

interface ComposeTweetProps {
  onClose: () => void
}

export default function ComposeTweet({ onClose }: ComposeTweetProps) {
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const charCount = text.length
  const overLimit = charCount > 280

  const handlePost = async () => {
    if (!text.trim() || overLimit || posting) return
    setPosting(true)
    setError(null)
    const result = await window.electronAPI.postTweet(text.trim())
    if (result.success) {
      setSuccess(true)
      setTimeout(() => onClose(), 1200)
    } else {
      setError(result.error || 'Failed to post')
    }
    setPosting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !overLimit && text.trim()) {
      handlePost()
    }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-[420px] max-w-[90vw] glass-card rounded-2xl p-5 shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {success ? (
          <div className="text-center py-6 animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent-emerald/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-white/80 font-medium">Posted!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-blue" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-xs font-display font-medium text-white/80">Compose Tweet</span>
              </div>
              <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white/60 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's happening?"
              autoFocus
              rows={4}
              className="w-full bg-surface-2 border border-white/[0.06] rounded-xl px-3 py-2.5 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 focus:bg-surface-3 transition-all placeholder-muted/50 resize-none"
            />

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono ${overLimit ? 'text-accent-red' : charCount > 250 ? 'text-accent-amber' : 'text-muted/60'}`}>
                  {charCount}/280
                </span>
                {charCount > 0 && (
                  <div className="w-16 h-1 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overLimit ? 'bg-accent-red' : charCount > 250 ? 'bg-accent-amber' : 'bg-accent-blue'}`}
                      style={{ width: `${Math.min(100, (charCount / 280) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {error && <span className="text-[10px] text-accent-red max-w-[180px] truncate">{error}</span>}
                <span className="text-[9px] text-muted/40">Ctrl+Enter</span>
                <button
                  onClick={handlePost}
                  disabled={!text.trim() || overLimit || posting}
                  className="px-4 py-1.5 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 rounded-lg text-xs text-white font-medium transition-all"
                >
                  {posting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Post'
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
