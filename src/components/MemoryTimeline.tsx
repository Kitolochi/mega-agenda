import { useState } from 'react'
import { Memory } from '../types'

const SOURCE_ICONS: Record<string, string> = {
  chat: '💬',
  cli_session: '⌨️',
  journal: '📝',
  task: '✅',
  ai_task: '🤖',
  manual: '✍️',
}

const IMPORTANCE_COLORS: Record<number, string> = {
  1: 'border-white/20',
  2: 'border-accent-blue',
  3: 'border-accent-red',
}

interface Props {
  memories: Memory[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
}

function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr)
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return monday.toISOString().split('T')[0]
}

function formatWeek(weekKey: string): string {
  const start = new Date(weekKey + 'T00:00:00')
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

export default function MemoryTimeline({ memories, onEdit, onDelete, onPin }: Props) {
  // Group by week
  const grouped = new Map<string, Memory[]>()
  memories.forEach(m => {
    const week = getWeekKey(m.createdAt)
    if (!grouped.has(week)) grouped.set(week, [])
    grouped.get(week)!.push(m)
  })

  const weeks = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  if (memories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-[11px]">
        No memories to display in timeline
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-white/[0.08]" />

      {weeks.map(([weekKey, mems]) => (
        <div key={weekKey} className="mb-6">
          {/* Sticky week header */}
          <div className="sticky top-0 z-10 -ml-6 mb-3">
            <div className="inline-flex items-center gap-2 bg-surface-1 px-3 py-1 rounded-lg border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-accent-purple" />
              <span className="text-[10px] font-medium text-white/70">{formatWeek(weekKey)}</span>
              <span className="text-[9px] text-muted">{mems.length} {mems.length === 1 ? 'memory' : 'memories'}</span>
            </div>
          </div>

          {/* Memory rows */}
          {mems.map(mem => (
            <MemoryRow key={mem.id} memory={mem} onEdit={onEdit} onDelete={onDelete} onPin={onPin} />
          ))}
        </div>
      ))}
    </div>
  )
}

function MemoryRow({ memory: mem, onEdit, onDelete, onPin }: { memory: Memory; onEdit: (id: string) => void; onDelete: (id: string) => void; onPin: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="relative mb-2 group">
      {/* Node dot */}
      <div className={`absolute -left-[13px] top-2 w-2.5 h-2.5 rounded-full border-2 bg-surface-0 ${IMPORTANCE_COLORS[mem.importance]}`} />

      <div
        className="bg-surface-2 rounded-lg border border-white/[0.04] hover:border-accent-purple/15 p-2.5 cursor-pointer transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs shrink-0">{SOURCE_ICONS[mem.sourceType] || '📎'}</span>
          <span className="text-[11px] font-medium text-white/90 flex-1 truncate">{mem.title}</span>
          {mem.isPinned && <span className="text-[9px]">📌</span>}
          <span className="text-[9px] text-muted/50">
            {new Date(mem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {expanded && (
          <div className="mt-2 pt-2 border-t border-white/[0.04]">
            <p className="text-[10px] text-muted leading-relaxed mb-2">{mem.content}</p>
            {mem.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {mem.topics.map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded-md bg-accent-purple/10 text-accent-purple text-[8px] font-medium">{t}</span>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <button onClick={e => { e.stopPropagation(); onPin(mem.id) }} className="px-2 py-0.5 rounded text-[9px] bg-surface-3 hover:bg-surface-4 text-muted hover:text-white transition-all">
                {mem.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button onClick={e => { e.stopPropagation(); onEdit(mem.id) }} className="px-2 py-0.5 rounded text-[9px] bg-surface-3 hover:bg-surface-4 text-muted hover:text-white transition-all">
                Edit
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(mem.id) }} className="px-2 py-0.5 rounded text-[9px] bg-surface-3 hover:bg-accent-red/20 text-muted hover:text-accent-red transition-all">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
