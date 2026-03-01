import { useChatStore } from '../../store/chatStore'

export default function ChatSidebar() {
  const {
    conversations, activeConvId, renameId, renameValue,
    setShowSidebar, setActiveConvId, setRenameId, setRenameValue,
    handleNewConversation, handleDeleteConversation, handleRename,
  } = useChatStore()

  return (
    <div className="absolute inset-0 z-20 flex animate-fade-in">
      <div className="w-56 bg-surface-1/95 backdrop-blur-md border-r border-white/[0.06] flex flex-col h-full animate-slide-up">
        <div className="p-2 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] font-medium text-white/70">Conversations</span>
          <button onClick={handleNewConversation} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all duration-200 hover:scale-110 active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations.map(c => (
            <div
              key={c.id}
              className={`group flex items-center px-2 py-1.5 cursor-pointer transition-all ${
                c.id === activeConvId ? 'bg-surface-3' : 'hover:bg-surface-2'
              }`}
              onClick={() => { setActiveConvId(c.id); setShowSidebar(false) }}
            >
              {renameId === c.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(c.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(c.id); if (e.key === 'Escape') setRenameId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-surface-3 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white/90 outline-none"
                />
              ) : (
                <span className="flex-1 text-[11px] text-white/70 truncate">{c.title}</span>
              )}
              <div className="hidden group-hover:flex gap-0.5 ml-1">
                <button
                  onClick={e => { e.stopPropagation(); setRenameId(c.id); setRenameValue(c.title) }}
                  className="p-0.5 rounded hover:bg-surface-4 text-muted"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteConversation(c.id) }}
                  className="p-0.5 rounded hover:bg-surface-4 text-muted hover:text-accent-red"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1" onClick={() => setShowSidebar(false)} />
    </div>
  )
}
