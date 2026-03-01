import { useChatStore } from '../../store/chatStore'
import { renderMarkdown } from '../../utils/markdown'

interface SmartQueryPanelProps {
  smartQueryTextRef: React.MutableRefObject<string>
}

export default function SmartQueryPanel({ smartQueryTextRef }: SmartQueryPanelProps) {
  const {
    smartQueryText, smartQueryStreaming,
    setSmartQueryText, setSmartQueryId,
  } = useChatStore()

  const handleDismiss = () => {
    setSmartQueryText('')
    setSmartQueryId(null)
    smartQueryTextRef.current = ''
  }

  return (
    <div className="px-3 py-2">
      <div className="rounded-xl border border-accent-purple/20 bg-accent-purple/5 p-3 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-accent-purple uppercase tracking-wider">Insights</span>
          {!smartQueryStreaming && (
            <button
              onClick={handleDismiss}
              className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="text-[12px] text-white/80 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(smartQueryText) }} />
          {smartQueryStreaming && <span className="inline-block w-1.5 h-3.5 bg-accent-purple/60 animate-pulse ml-0.5" />}
        </div>
      </div>
    </div>
  )
}
