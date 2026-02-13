import { useState } from 'react'
import ChatView from './ChatView'
import CLIHistoryView from './CLIHistoryView'

type ChatSubView = 'chat' | 'cli'

export default function ChatTab() {
  const [subView, setSubView] = useState<ChatSubView>('chat')

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Toggle bar */}
      <div className="px-4 pt-3">
        <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
          <button
            onClick={() => setSubView('chat')}
            className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all ${
              subView === 'chat' ? 'bg-surface-4 text-white shadow-sm' : 'text-muted hover:text-white/60'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setSubView('cli')}
            className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all ${
              subView === 'cli' ? 'bg-surface-4 text-white shadow-sm' : 'text-muted hover:text-white/60'
            }`}
          >
            CLI History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subView === 'chat' ? <ChatView /> : <CLIHistoryView />}
      </div>
    </div>
  )
}
