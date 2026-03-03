import { useState } from 'react'
import { useNetworkStore } from '../../store'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import ContactAvatar from './ContactAvatar'
import ContactForm from './ContactForm'
import InteractionForm from './InteractionForm'
import InteractionItem from './InteractionItem'

export default function ContactDetail() {
  const { contacts, interactions, selectedContactId, selectContact, updateContact, deleteContact, createInteraction, deleteInteraction } = useNetworkStore()
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const contact = contacts.find(c => c.id === selectedContactId)
  if (!contact) return null

  const contactInteractions = interactions.filter(i => i.contactIds.includes(contact.id))

  const handleDelete = async () => {
    await deleteContact(contact.id)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => selectContact(null)}
        className="flex items-center gap-1.5 text-muted hover:text-white/80 text-xs mb-4 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to contacts
      </button>

      {/* Profile header */}
      <div className="glass-card rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4">
          <ContactAvatar name={contact.name} color={contact.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white/95">{contact.name}</h2>
            {(contact.role || contact.company) && (
              <p className="text-sm text-muted">
                {contact.role}{contact.role && contact.company ? ' at ' : ''}{contact.company}
              </p>
            )}
            {contact.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {contact.tags.map(tag => (
                  <Badge key={tag} variant="blue">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="xs" onClick={() => setEditOpen(true)}>Edit</Button>
            {confirmDelete ? (
              <div className="flex gap-1">
                <Button variant="danger" size="xs" onClick={handleDelete}>Confirm</Button>
                <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(true)}>Delete</Button>
            )}
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 pt-4 border-t border-white/[0.06]">
          {contact.email && (
            <div>
              <span className="text-[10px] text-muted block">Email</span>
              <span className="text-xs text-white/80">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div>
              <span className="text-[10px] text-muted block">Phone</span>
              <span className="text-xs text-white/80">{contact.phone}</span>
            </div>
          )}
          {contact.socialLinks?.twitter && (
            <div>
              <span className="text-[10px] text-muted block">Twitter</span>
              <span className="text-xs text-white/80">{contact.socialLinks.twitter}</span>
            </div>
          )}
          {contact.socialLinks?.linkedin && (
            <div>
              <span className="text-[10px] text-muted block">LinkedIn</span>
              <span className="text-xs text-white/80">{contact.socialLinks.linkedin}</span>
            </div>
          )}
          {contact.socialLinks?.github && (
            <div>
              <span className="text-[10px] text-muted block">GitHub</span>
              <span className="text-xs text-white/80">{contact.socialLinks.github}</span>
            </div>
          )}
        </div>

        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <span className="text-[10px] text-muted block mb-1">Notes</span>
            <p className="text-xs text-white/70 whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Interaction timeline */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white/90">Interactions</h3>
          <Button variant="primary" size="xs" onClick={() => setLogOpen(true)}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Log
          </Button>
        </div>

        {contactInteractions.length === 0 ? (
          <EmptyState
            title="No interactions yet"
            description="Log calls, emails, meetings, and notes"
            action={{ label: 'Log Interaction', onClick: () => setLogOpen(true) }}
          />
        ) : (
          <div>
            {contactInteractions.map(i => (
              <InteractionItem key={i.id} interaction={i} onDelete={deleteInteraction} />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <ContactForm
          open={editOpen}
          onClose={() => setEditOpen(false)}
          contact={contact}
          onSave={async (data) => {
            await updateContact(contact.id, data)
          }}
        />
      )}

      {/* Log interaction modal */}
      {logOpen && (
        <InteractionForm
          open={logOpen}
          onClose={() => setLogOpen(false)}
          contactId={contact.id}
          onSave={async (data) => {
            await createInteraction(data)
          }}
        />
      )}
    </div>
  )
}
