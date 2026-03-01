import { useSocialStore } from '../../store/socialStore'

interface ThreadEditorProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  saveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

export default function ThreadEditor({ textareaRef, saveTimeoutRef }: ThreadEditorProps) {
  const {
    segments, posting, postProgress, postResult,
    handleSegmentChange, addSegment, removeSegment,
    handlePost, handleCopy,
  } = useSocialStore()
  const activeDraft = useSocialStore(s => s.getActiveDraft())
  const hasContent = segments.some(s => s.trim())
  const anyOverLimit = segments.some(s => s.length > 280)

  if (!activeDraft) return null

  return (
    <div className="space-y-2">
      {segments.map((seg, i) => (
        <div key={i} className="glass-card rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted font-mono">{i + 1}/{segments.length}</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-mono ${seg.length > 280 ? 'text-accent-red' : seg.length > 250 ? 'text-accent-amber' : 'text-muted/60'}`}>
                {seg.length}/280
              </span>
              {segments.length > 1 && (
                <button
                  onClick={() => removeSegment(i)}
                  className="w-5 h-5 rounded hover:bg-accent-red/20 flex items-center justify-center text-muted hover:text-accent-red transition-all"
                  title="Remove segment"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <textarea
            ref={i === 0 ? textareaRef : undefined}
            value={seg}
            onChange={e => handleSegmentChange(i, e.target.value, saveTimeoutRef)}
            placeholder={i === 0 ? 'First tweet (the hook)...' : `Tweet ${i + 1}...`}
            rows={3}
            className="w-full bg-transparent border-none text-sm text-white/90 focus:outline-none resize-none placeholder-muted/50"
          />
          {seg.length > 0 && (
            <div className="w-full h-1 rounded-full bg-surface-3 overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all ${seg.length > 280 ? 'bg-accent-red' : seg.length > 250 ? 'bg-accent-amber' : 'bg-accent-blue'}`}
                style={{ width: `${Math.min(100, (seg.length / 280) * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
      <button
        onClick={addSegment}
        className="w-full py-2 rounded-xl border border-dashed border-white/[0.08] hover:border-white/[0.15] hover:bg-surface-2/50 text-[11px] text-muted hover:text-white/60 font-medium transition-all"
      >
        + Add tweet to thread
      </button>
      {/* Thread action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {postResult && (
            <span className={`text-[10px] ${postResult.success ? 'text-accent-emerald' : 'text-accent-red'}`}>
              {postResult.success ? 'Thread posted!' : postResult.error}
            </span>
          )}
          {postProgress && (
            <span className="text-[10px] text-accent-amber">{postProgress}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            disabled={!hasContent}
            className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 text-[10px] text-white/60 font-medium transition-all"
            title="Copy thread"
          >
            Copy
          </button>
          <button
            onClick={handlePost}
            disabled={!hasContent || anyOverLimit || posting || activeDraft.status === 'posted'}
            className="px-3 py-1 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 rounded-lg text-[10px] text-white font-medium transition-all"
          >
            {posting ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : activeDraft.status === 'posted' ? 'Posted' : 'Post Thread'}
          </button>
        </div>
      </div>
    </div>
  )
}
