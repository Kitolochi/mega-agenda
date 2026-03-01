import { useEffect, useRef } from 'react'
import { useSocialStore } from '../../store/socialStore'
import DraftSelector from './DraftSelector'
import TweetEditor from './TweetEditor'
import ThreadEditor from './ThreadEditor'
import AIAssistPanel from './AIAssistPanel'
import PersonaSelector from './PersonaSelector'

export default function SocialTab() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    activeDraftId, showDraftList, isThread, topicInput,
    aiResponse, aiLoading, freeformInput,
    loadDrafts, loadPersonas, loadActiveDraftState,
    handleNewDraft, handleDeleteDraft,
    handleBrainstorm, handleRefine, handleAnalyze, handleFreeform,
    setShowDraftList, setTopicInput, setFreeformInput,
  } = useSocialStore()

  const activeDraft = useSocialStore(s => s.getActiveDraft())
  const hasContent = useSocialStore(s => s.isThread ? s.segments.some(seg => seg.trim()) : s.text.trim().length > 0)

  useEffect(() => {
    loadDrafts()
    loadPersonas()
  }, [loadDrafts, loadPersonas])

  // When active draft changes, load its state
  useEffect(() => {
    loadActiveDraftState()
  }, [activeDraftId]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-white/10 text-white/50',
      refining: 'bg-accent-amber/20 text-accent-amber',
      ready: 'bg-accent-emerald/20 text-accent-emerald',
      posted: 'bg-accent-blue/20 text-accent-blue'
    }
    return colors[status] || colors.draft
  }

  return (
    <div className="h-full flex flex-col overflow-hidden tab-content-enter">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <button
          onClick={() => setShowDraftList(!showDraftList)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-all text-left min-w-0"
        >
          <svg className="w-3 h-3 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-[11px] text-white/70 truncate">
            {activeDraft ? (activeDraft.topic || activeDraft.text.slice(0, 40) || 'Untitled draft') : 'Select a draft'}
          </span>
          {activeDraft && (
            <>
              {activeDraft.isThread && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple shrink-0">thread</span>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(activeDraft.status)}`}>
                {activeDraft.status}
              </span>
            </>
          )}
        </button>
        <button
          onClick={() => handleNewDraft()}
          className="px-2.5 py-1.5 rounded-lg bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue text-[11px] font-medium transition-all shrink-0"
        >
          + New
        </button>
        {activeDraft && (
          <button
            onClick={handleDeleteDraft}
            className="w-7 h-7 rounded-lg hover:bg-accent-red/20 flex items-center justify-center text-muted hover:text-accent-red transition-all shrink-0"
            title="Delete draft"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Draft List Overlay */}
      {showDraftList && <DraftSelector statusBadge={statusBadge} />}

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {!activeDraft ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-muted" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <p className="text-sm text-white/70 font-medium mb-1">Social Media Manager</p>
            <p className="text-[11px] text-muted mb-4">Craft tweets with AI-powered rhetoric</p>
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && topicInput.trim()) handleNewDraft(topicInput.trim()) }}
                placeholder="What do you want to tweet about?"
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all placeholder-muted/50"
              />
              <button
                onClick={() => handleNewDraft(topicInput.trim() || undefined)}
                className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 rounded-lg text-xs text-white font-medium transition-all shrink-0"
              >
                Start
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <PersonaSelector />

            {/* Thread Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => useSocialStore.getState().toggleThread()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  isThread
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : 'bg-surface-2 text-white/50 hover:bg-surface-3 hover:text-white/70'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {isThread ? 'Thread mode' : 'Single tweet'}
              </button>
              {isThread && (
                <span className="text-[10px] text-muted">
                  {useSocialStore.getState().segments.length} tweet{useSocialStore.getState().segments.length !== 1 ? 's' : ''} in thread
                </span>
              )}
            </div>

            {/* Tweet Editor */}
            {isThread ? (
              <ThreadEditor textareaRef={textareaRef} saveTimeoutRef={saveTimeoutRef} />
            ) : (
              <TweetEditor textareaRef={textareaRef} saveTimeoutRef={saveTimeoutRef} />
            )}

            {/* Action Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={handleBrainstorm}
                disabled={aiLoading || (!hasContent && !activeDraft.topic)}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">{'💡'}</span> Brainstorm
              </button>
              <button
                onClick={() => handleRefine()}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">{'✨'}</span> Refine
              </button>
              <button
                onClick={handleAnalyze}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">{'🎯'}</span> Analyze
              </button>
              <button
                onClick={() => handleRefine('Make it punchier and more concise. Remove filler words.')}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">{'⚡'}</span> Punchier
              </button>
              <button
                onClick={() => handleRefine('Add a strong hook in the first line that makes people stop scrolling.')}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">{'🪝'}</span> Add hook
              </button>
              <button
                onClick={() => handleRefine('Take a contrarian or surprising angle on this same topic.')}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">{'🔄'}</span> Contrarian
              </button>
            </div>

            {/* AI Response Panel */}
            {(aiLoading || aiResponse) && <AIAssistPanel />}

            {/* Freeform Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={freeformInput}
                onChange={e => setFreeformInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && freeformInput.trim()) handleFreeform() }}
                placeholder={isThread ? "Ask Claude anything about this thread..." : "Ask Claude anything about this tweet..."}
                disabled={aiLoading}
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all placeholder-muted/50 disabled:opacity-50"
              />
              <button
                onClick={handleFreeform}
                disabled={aiLoading || !freeformInput.trim()}
                className="px-3 py-2 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 disabled:opacity-30 text-[11px] text-accent-purple font-medium transition-all shrink-0"
              >
                Ask
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
