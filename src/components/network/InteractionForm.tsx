import { useState } from 'react'
import { InteractionType } from '../../types'
import Dialog from '../ui/Dialog'
import Input from '../ui/Input'
import Button from '../ui/Button'

interface InteractionFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: { contactIds: string[]; type: InteractionType; subject: string; notes: string; date: string }) => Promise<void>
  contactId: string
}

const TYPES: { value: InteractionType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'message', label: 'Message' },
  { value: 'note', label: 'Note' },
]

export default function InteractionForm({ open, onClose, onSave, contactId }: InteractionFormProps) {
  const [type, setType] = useState<InteractionType>('note')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim()) return
    setSaving(true)
    try {
      await onSave({
        contactIds: [contactId],
        type,
        subject: subject.trim(),
        notes: notes.trim(),
        date,
      })
      setSubject('')
      setNotes('')
      setType('note')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-white/[0.06] rounded-2xl p-6 w-[380px] space-y-3">
        <h2 className="text-sm font-semibold text-white/90 mb-4">Log Interaction</h2>

        <div className="space-y-1">
          <label className="text-[11px] text-muted font-medium">Type</label>
          <div className="flex gap-1.5">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 ${
                  type === t.value
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                    : 'bg-surface-2 text-muted hover:text-white/70 border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Input label="Subject *" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Discussed partnership" autoFocus />
        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />

        <div className="space-y-1">
          <label className="text-[11px] text-muted font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Details..."
            rows={3}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all duration-150 placeholder-muted/50 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!subject.trim()}>Log</Button>
        </div>
      </form>
    </Dialog>
  )
}
