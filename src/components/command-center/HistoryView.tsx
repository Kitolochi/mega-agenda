import { useEffect, useState } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { ChevronRight, DollarSign, FileEdit } from 'lucide-react'

export default function HistoryView() {
  const { history, historyFilter, projects, loadHistory, loadProjects, setHistoryFilter } = useCommandCenterStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadHistory(); loadProjects() }, [])

  return (
    <div>
      {/* Filter */}
      <div className="mb-3">
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
      </div>

      {/* Entries */}
      {history.length === 0 ? (
        <p className="text-[11px] text-white/30 text-center py-8">No history yet.</p>
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

              {/* Expanded detail */}
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
      )}
    </div>
  )
}
