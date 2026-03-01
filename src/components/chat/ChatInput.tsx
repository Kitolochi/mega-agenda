import { useChatStore } from '../../store/chatStore'

interface ChatInputProps {
  inputRef: React.RefObject<HTMLTextAreaElement>
  streamTextRef: React.MutableRefObject<string>
  smartQueryTextRef: React.MutableRefObject<string>
}

export default function ChatInput({ inputRef, streamTextRef, smartQueryTextRef }: ChatInputProps) {
  const {
    input, streaming, settings, memoryCount, chatModels,
    setInput, handleSend, handleAbort, handleSaveSettings,
  } = useChatStore()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(streamTextRef, smartQueryTextRef, inputRef)
    }
  }

  return (
    <div className="px-3 pb-3 pt-1">
      <div className="flex gap-2 items-end bg-surface-2 rounded-xl border border-white/[0.06] p-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          className="flex-1 bg-transparent text-[12px] text-white/90 placeholder-muted/40 resize-none outline-none max-h-24 leading-relaxed"
          style={{ minHeight: '20px' }}
          onInput={e => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = Math.min(target.scrollHeight, 96) + 'px'
          }}
        />
        {streaming ? (
          <button
            onClick={() => handleAbort(streamTextRef)}
            className="shrink-0 w-7 h-7 rounded-lg bg-accent-red/20 hover:bg-accent-red/30 flex items-center justify-center transition-all"
          >
            <svg className="w-3 h-3 text-accent-red" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => handleSend(streamTextRef, smartQueryTextRef, inputRef)}
            disabled={!input.trim()}
            className="shrink-0 w-7 h-7 rounded-lg bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 flex items-center justify-center transition-all"
          >
            <svg className="w-3 h-3 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      {settings && (
        <div className="flex items-center justify-between mt-1 px-1">
          <div className="flex items-center gap-1.5">
            <select
              value={settings.model}
              onChange={e => handleSaveSettings({ model: e.target.value })}
              className="bg-surface-2 text-[9px] text-muted/60 hover:text-white/60 outline-none cursor-pointer appearance-none pr-3 rounded px-1 py-0.5 transition-colors [&>option]:bg-surface-2 [&>option]:text-white/80"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.25)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
            >
              {chatModels.length > 0 ? chatModels.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              )) : (
                <>
                  <option value="claude-sonnet-4-5-20250929">Sonnet 4.5</option>
                  <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
                  <option value="claude-opus-4-6">Opus 4.6</option>
                </>
              )}
            </select>
            {settings.systemPromptMode === 'context' && (
              <span className="text-[9px] text-muted/40">· Context</span>
            )}
            {memoryCount > 0 && settings.systemPromptMode === 'context' && (
              <span className="text-[9px] text-accent-purple/60">· {memoryCount} {memoryCount === 1 ? 'memory' : 'memories'}</span>
            )}
          </div>
          <span className="text-[9px] text-muted/40">Shift+Enter for newline</span>
        </div>
      )}
    </div>
  )
}
