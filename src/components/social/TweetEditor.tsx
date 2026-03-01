import { useSocialStore } from '../../store/socialStore'

interface TweetEditorProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  saveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

export default function TweetEditor({ textareaRef, saveTimeoutRef }: TweetEditorProps) {
  const {
    text, posting, postResult,
    handleTextChange, handlePost, handleCopy,
  } = useSocialStore()
  const activeDraft = useSocialStore(s => s.getActiveDraft())

  const charCount = text.length
  const overLimit = charCount > 280

  if (!activeDraft) return null

  return (
    <div className="glass-card rounded-xl p-3">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => handleTextChange(e.target.value, saveTimeoutRef)}
        placeholder="Write your tweet..."
        rows={4}
        className="w-full bg-transparent border-none text-sm text-white/90 focus:outline-none resize-none placeholder-muted/50"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
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
        <div className="flex items-center gap-1.5">
          {postResult && (
            <span className={`text-[10px] ${postResult.success ? 'text-accent-emerald' : 'text-accent-red'}`}>
              {postResult.success ? 'Posted!' : postResult.error}
            </span>
          )}
          <button
            onClick={handleCopy}
            disabled={!text.trim()}
            className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 text-[10px] text-white/60 font-medium transition-all"
            title="Copy to clipboard"
          >
            Copy
          </button>
          <button
            onClick={handlePost}
            disabled={!text.trim() || overLimit || posting || activeDraft.status === 'posted'}
            className="px-3 py-1 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 rounded-lg text-[10px] text-white font-medium transition-all"
          >
            {posting ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : activeDraft.status === 'posted' ? 'Posted' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
