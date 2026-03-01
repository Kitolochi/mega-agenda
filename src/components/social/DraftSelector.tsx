import { useSocialStore } from '../../store/socialStore'

interface DraftSelectorProps {
  statusBadge: (status: string) => string
}

export default function DraftSelector({ statusBadge }: DraftSelectorProps) {
  const {
    drafts, activeDraftId, showDraftList,
    setShowDraftList, handleSelectDraft,
  } = useSocialStore()

  if (!showDraftList) return null

  return (
    <div className="absolute inset-0 z-30 bg-surface-0/95 backdrop-blur-sm flex flex-col animate-fade-in">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/[0.06]">
        <span className="text-xs font-display font-medium text-white/80">Drafts</span>
        <button
          onClick={() => setShowDraftList(false)}
          className="w-6 h-6 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white/60 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {drafts.length === 0 ? (
          <div className="text-center py-8 text-muted text-xs">No drafts yet</div>
        ) : (
          <div className="space-y-1">
            {drafts.map(d => (
              <button
                key={d.id}
                onClick={() => handleSelectDraft(d.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                  d.id === activeDraftId ? 'bg-accent-blue/10 border border-accent-blue/20' : 'hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/80 flex-1 truncate">
                    {d.topic || d.text.slice(0, 50) || 'Untitled'}
                  </span>
                  {d.isThread && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple shrink-0">thread</span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(d.status)}`}>
                    {d.status}
                  </span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  {new Date(d.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
