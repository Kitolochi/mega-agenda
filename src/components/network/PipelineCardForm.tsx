import { useState } from 'react'
import { PipelineCard, NetworkContact } from '../../types'
import Dialog from '../ui/Dialog'
import Input from '../ui/Input'
import Button from '../ui/Button'

interface PipelineCardFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: { contactId: string; pipelineId: string; stage: string; title: string; description: string; value: string }) => Promise<void>
  contacts: NetworkContact[]
  pipelineId: string
  stages: string[]
  card?: PipelineCard
}

export default function PipelineCardForm({ open, onClose, onSave, contacts, pipelineId, stages, card }: PipelineCardFormProps) {
  const [contactId, setContactId] = useState(card?.contactId || '')
  const [stage, setStage] = useState(card?.stage || stages[0] || '')
  const [title, setTitle] = useState(card?.title || '')
  const [description, setDescription] = useState(card?.description || '')
  const [value, setValue] = useState(card?.value || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !contactId) return
    setSaving(true)
    try {
      await onSave({
        contactId,
        pipelineId,
        stage,
        title: title.trim(),
        description: description.trim(),
        value: value.trim(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-white/[0.06] rounded-2xl p-6 w-[400px] space-y-3">
        <h2 className="text-sm font-semibold text-white/90 mb-4">
          {card ? 'Edit Card' : 'Add Pipeline Card'}
        </h2>

        <Input label="Title *" value={title} onChange={e => setTitle(e.target.value)} placeholder="Partnership deal" autoFocus />

        <div className="space-y-1">
          <label className="text-[11px] text-muted font-medium">Contact *</label>
          <select
            value={contactId}
            onChange={e => setContactId(e.target.value)}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all"
          >
            <option value="">Select contact...</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted font-medium">Stage</label>
          <div className="flex gap-1.5 flex-wrap">
            {stages.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  stage === s
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                    : 'bg-surface-2 text-muted hover:text-white/70 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <Input label="Value" value={value} onChange={e => setValue(e.target.value)} placeholder="$50k, Partnership, etc." />

        <div className="space-y-1">
          <label className="text-[11px] text-muted font-medium">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Details..."
            rows={2}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all placeholder-muted/50 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!title.trim() || !contactId}>
            {card ? 'Save' : 'Add Card'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
