import { useEffect, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { ChevronRight, DollarSign, FileEdit, MessageSquare, Clock } from 'lucide-react'
import type { CLISession, CLISessionMessage } from '../../types'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function projectNameFromEncoded(encoded: string): string {
  // "C--Users-chris-mega-agenda" → "mega-agenda" (last meaningful segment)
  const parts = encoded.split('-')
  // Find last non-empty segment group (heuristic: take everything after "chris" or last 1-2 segments)
  const chrisIdx = parts.indexOf('chris')
  if (chrisIdx >= 0 && chrisIdx < parts.length - 1) {
    return parts.slice(chrisIdx + 1).join('-')
  }
  return parts[parts.length - 1] || encoded
}

export default function HistoryView() {
  const { history, historyFilter, projects, loadHistory, loadProjects, setHistoryFilter } = useCommandCenterStore()
  const [cliSessions, setCliSessions] = useState<CLISession[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<CLISessionMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [activeTab, setActiveTab] = useState<'cli' | 'cc'>('cli')

  useEffect(() => {
    loadHistory()
    loadProjects()
    loadCliSessions()
  }, [])

  const loadCliSessions = async () => {
    const sessions = await window.electronAPI.getCliSessions()
    setCliSessions(sessions)
  }

  const handleExpandSession = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null)
      setExpandedMessages([])
      return
    }
    setExpandedId(sessionId)
    setLoadingMessages(true)
    const { messages } = await window.electronAPI.getCliSessionMessages(sessionId, 0, 20)
    setExpandedMessages(messages)
    setLoadingMessages(false)
  }

  // Filter CLI sessions by project name
  const filteredSessions = historyFilter
    ? cliSessions.filter(s => {
        const name = projectNameFromEncoded(s.project)
        return historyFilter.endsWith(name) || historyFilter.includes(name)
      })
    : cliSessions

  return (
    <div>
      {/* Filter + Tab toggle */}
      <div className="flex items-center gap-3 mb-3">
        <select
          value={historyFilter || ''}
          onChange={e => setHistoryFilter(e.target.value || null)}
          className="bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[10px] text-white/70 focus:outline-none"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.path} value={p.path}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="flex bg-surface-2 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => setActiveTab('cli')}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
              activeTab === 'cli' ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'
            }`}
          >
            CLI Sessions ({filteredSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('cc')}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
              activeTab === 'cc' ? 'bg-surface-4 text-white/90' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Command Center ({history.length})
          </button>
        </div>
      </div>

      {activeTab === 'cli' ? (
        /* CLI Sessions */
        filteredSessions.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-8">No CLI sessions found.</p>
        ) : (
          <div className="space-y-1">
            {filteredSessions.map(session => (
              <div key={session.sessionId}>
                <div
                  onClick={() => handleExpandSession(session.sessionId)}
                  className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/[0.08] transition-all"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight size={10} className={`text-white/20 transition-transform flex-shrink-0 ${expandedId === session.sessionId ? 'rotate-90' : ''}`} />
                    <Badge>{projectNameFromEncoded(session.project)}</Badge>
                    <span className="text-[10px] text-white/60 truncate">
                      {session.firstPrompt || 'No prompt'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <MessageSquare size={8} />{session.messageCount}
                    </span>
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <Clock size={8} />{relativeTime(session.modified)}
                    </span>
                  </div>
                </div>

                {/* Expanded: messages */}
                {expandedId === session.sessionId && (
                  <div className="bg-surface-0 border border-white/[0.04] rounded-b-lg px-4 py-3 -mt-1 max-h-72 overflow-y-auto space-y-2">
                    {loadingMessages ? (
                      <p className="text-[10px] text-white/30">Loading messages...</p>
                    ) : expandedMessages.length === 0 ? (
                      <p className="text-[10px] text-white/30">No messages found.</p>
                    ) : (
                      expandedMessages.map((msg, i) => (
                        <div key={i} className={`text-[11px] ${msg.type === 'user' ? 'text-white/70' : 'text-white/40'}`}>
                          <span className={`text-[9px] font-medium uppercase mr-2 ${msg.type === 'user' ? 'text-accent-blue' : 'text-accent-purple'}`}>
                            {msg.type}
                          </span>
                          {msg.content.slice(0, 300)}
                          {msg.content.length > 300 && <span className="text-white/20">...</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Command Center History */
        history.length === 0 ? (
          <p className="text-[11px] text-white/30 text-center py-8">No Command Center history yet. Launch a task to get started.</p>
        ) : (
          <div className="space-y-1">
            {history.map(entry => (
              <div key={entry.id}>
                <div
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/[0.08] transition-all"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ChevronRight size={10} className={`text-white/20 transition-transform flex-shrink-0 ${expandedId === entry.id ? 'rotate-90' : ''}`} />
                    <Badge>{entry.projectName}</Badge>
                    <span className="text-[10px] text-white/60 truncate">{entry.summary}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <DollarSign size={8} />{entry.costUsd.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-white/20 flex items-center gap-1">
                      <FileEdit size={8} />{entry.filesChanged.length}
                    </span>
                    <span className="text-[9px] text-white/20">
                      {new Date(entry.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {expandedId === entry.id && (
                  <div className="bg-surface-0 border border-white/[0.04] rounded-b-lg px-4 py-3 -mt-1 space-y-2">
                    <div>
                      <span className="text-[9px] text-white/30 uppercase">Prompt</span>
                      <p className="text-[11px] text-white/60 mt-0.5">{entry.prompt}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/30 uppercase">Summary</span>
                      <p className="text-[11px] text-white/60 mt-0.5">{entry.summary}</p>
                    </div>
                    {entry.filesChanged.length > 0 && (
                      <div>
                        <span className="text-[9px] text-white/30 uppercase">Files ({entry.filesChanged.length})</span>
                        <div className="mt-1 space-y-0.5">
                          {entry.filesChanged.map((f, i) => (
                            <div key={i} className="text-[10px] text-white/40 font-mono">{f}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-4 text-[9px] text-white/30 pt-1">
                      <span>Cost: ${entry.costUsd.toFixed(4)}</span>
                      <span>Turns: {entry.turnCount}</span>
                      <span>Duration: {Math.round((entry.completedAt - entry.startedAt) / 60000)}m</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
