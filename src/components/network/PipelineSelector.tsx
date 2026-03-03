import { useState } from 'react'
import { Pipeline } from '../../types'
import Button from '../ui/Button'

interface PipelineSelectorProps {
  pipelines: Pipeline[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string, stages: string[]) => Promise<void>
  onDelete: (id: string) => void
}

export default function PipelineSelector({ pipelines, selectedId, onSelect, onCreate, onDelete }: PipelineSelectorProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await onCreate(newName.trim(), ['Lead', 'Contacted', 'Responded', 'Meeting', 'Closed'])
      setNewName('')
      setCreating(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {pipelines.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              selectedId === p.id
                ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                : 'bg-surface-2 text-muted hover:text-white/70 border border-transparent'
            }`}
          >
            {p.name}
            {pipelines.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent-red ml-1 transition-opacity"
                title="Delete pipeline"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex items-center gap-1.5">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Pipeline name"
            autoFocus
            className="bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 w-32"
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
          />
          <Button variant="primary" size="xs" onClick={handleCreate} loading={saving} disabled={!newName.trim()}>Add</Button>
          <Button variant="ghost" size="xs" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="ghost" size="xs" onClick={() => setCreating(true)}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Pipeline
        </Button>
      )}
    </div>
  )
}
