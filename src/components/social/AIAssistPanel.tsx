import { useSocialStore, extractTweets } from '../../store/socialStore'
import { renderMarkdown } from '../../utils/markdown'

export default function AIAssistPanel() {
  const {
    aiResponse, aiLoading, isThread,
    handleUseTweet, handleUseAllTweets,
  } = useSocialStore()
  const activePersona = useSocialStore(s => s.getActivePersona())

  const extractedTweets = aiResponse ? extractTweets(aiResponse) : []

  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-4 h-4 rounded-full bg-accent-purple/20 flex items-center justify-center">
          <span className="text-[8px]">{'✦'}</span>
        </div>
        <span className="text-[10px] text-muted uppercase tracking-wider font-display">Claude</span>
        {activePersona && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple/70">
            as {activePersona.name}
          </span>
        )}
        {aiLoading && (
          <div className="w-3 h-3 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin ml-1" />
        )}
      </div>
      {aiLoading ? (
        <div className="text-[11px] text-muted animate-pulse">Thinking...</div>
      ) : (
        <div className="space-y-2">
          <div
            className="text-[12px] text-white/80 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(aiResponse) }}
          />
          {/* "Use this" buttons for extractable tweets */}
          {extractedTweets.length > 0 && (
            <div className="space-y-1.5 mt-2 pt-2 border-t border-white/[0.04]">
              {isThread && extractedTweets.length > 1 && (
                <button
                  onClick={handleUseAllTweets}
                  className="w-full px-3 py-1.5 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 text-[10px] text-accent-purple font-medium transition-all mb-1"
                >
                  Use all as thread ({extractedTweets.length} tweets)
                </button>
              )}
              {extractedTweets.map((tweet, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-surface-2/50">
                  <p className="text-[11px] text-white/70 flex-1 leading-relaxed">{tweet}</p>
                  <button
                    onClick={() => handleUseTweet(tweet)}
                    className="px-2 py-1 rounded-md bg-accent-blue/20 hover:bg-accent-blue/30 text-[10px] text-accent-blue font-medium transition-all shrink-0"
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
