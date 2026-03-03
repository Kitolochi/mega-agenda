import { useState } from 'react'
import { NetworkContact } from '../../types'
import Dialog from '../ui/Dialog'
import Input from '../ui/Input'
import Button from '../ui/Button'

interface ContactFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  contact?: NetworkContact
}

export default function ContactForm({ open, onClose, onSave, contact }: ContactFormProps) {
  const [name, setName] = useState(contact?.name || '')
  const [company, setCompany] = useState(contact?.company || '')
  const [role, setRole] = useState(contact?.role || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [twitter, setTwitter] = useState(contact?.socialLinks?.twitter || '')
  const [linkedin, setLinkedin] = useState(contact?.socialLinks?.linkedin || '')
  const [github, setGithub] = useState(contact?.socialLinks?.github || '')
  const [notes, setNotes] = useState(contact?.notes || '')
  const [tagsStr, setTagsStr] = useState(contact?.tags?.join(', ') || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        company: company.trim(),
        role: role.trim(),
        email: email.trim(),
        phone: phone.trim(),
        socialLinks: {
          twitter: twitter.trim() || undefined,
          linkedin: linkedin.trim() || undefined,
          github: github.trim() || undefined,
        },
        notes: notes.trim(),
        tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
        avatarColor: contact?.avatarColor || '',
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-surface-1 border border-white/[0.06] rounded-2xl p-6 w-[420px] max-h-[85vh] overflow-y-auto space-y-3">
        <h2 className="text-sm font-semibold text-white/90 mb-4">
          {contact ? 'Edit Contact' : 'Add Contact'}
        </h2>

        <Input label="Name *" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" autoFocus />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Inc" />
          <Input label="Role" value={role} onChange={e => setRole(e.target.value)} placeholder="CEO" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@acme.com" type="email" />
          <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-0123" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Twitter" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="@handle" />
          <Input label="LinkedIn" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="username" />
          <Input label="GitHub" value={github} onChange={e => setGithub(e.target.value)} placeholder="username" />
        </div>

        <Input label="Tags" value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="investor, tech, priority" />

        <div className="space-y-1">
          <label className="text-[11px] text-muted font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional context..."
            rows={3}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all duration-150 placeholder-muted/50 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
            {contact ? 'Save' : 'Add Contact'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
