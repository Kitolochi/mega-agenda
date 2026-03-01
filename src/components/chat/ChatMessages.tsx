import { useChatStore } from '../../store/chatStore'
import { renderMarkdown } from '../../utils/markdown'

interface ChatMessagesProps {
  messagesEndRef: React.RefObject<HTMLDivElement>
}

export default function ChatMessages({ messagesEndRef }: ChatMessagesProps) {
  const streaming = useChatStore(s => s.streaming)
  const streamText = useChatStore(s => s.streamText)
  const activeConv = useChatStore(s => s.getActiveConv())

  return (
    <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
      {!activeConv || activeConv.messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-[11px] text-muted mb-1">Start a conversation with Claude</p>
          <p className="text-[10px] text-muted/50">Messages are saved locally</p>
        </div>
      ) : (
        <>
          {activeConv.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent-blue/20 text-white/90'
                  : 'bg-surface-2 text-white/80'
              }`}>
                {msg.role === 'assistant' ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
                {msg.tokenUsage && (
                  <div className="text-[9px] text-muted/40 mt-1">
                    {msg.tokenUsage.input + msg.tokenUsage.output} tokens
                  </div>
                )}
              </div>
            </div>
          ))}
          {streaming && streamText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed bg-surface-2 text-white/80">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }} />
                <span className="inline-block w-1.5 h-3.5 bg-accent-blue/60 animate-pulse ml-0.5" />
              </div>
            </div>
          )}
          {streaming && !streamText && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3 py-2 bg-surface-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-muted/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
