import { useState, useMemo } from 'react'
import { useNetworkStore } from '../../store'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import ContactCard from './ContactCard'
import ContactForm from './ContactForm'

export default function ContactList() {
  const { contacts, searchQuery, tagFilter, setSearchQuery, setTagFilter, selectContact, createContact } = useNetworkStore()
  const [formOpen, setFormOpen] = useState(false)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    contacts.forEach(c => c.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [contacts])

  const filtered = useMemo(() => {
    let result = contacts
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (tagFilter) {
      result = result.filter(c => c.tags.includes(tagFilter))
    }
    return result
  }, [contacts, searchQuery, tagFilter])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white/90">Contacts</h2>
        <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </Button>
      </div>

      {/* Search + tag filter */}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all placeholder-muted/50"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  tagFilter === tag
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                    : 'bg-surface-2 text-muted hover:text-white/70 border border-transparent'
                }`}
              >
                {tag}
              </button>
            ))}
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="px-2 py-1 rounded-full text-[10px] font-medium text-muted hover:text-white/70"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contact grid */}
      {contacts.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          title="No contacts yet"
          description="Add your first contact to start building your network"
          action={{ label: 'Add Contact', onClick: () => setFormOpen(true) }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No contacts match" description="Try adjusting your search or filter" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(contact => (
            <ContactCard key={contact.id} contact={contact} onClick={() => selectContact(contact.id)} />
          ))}
        </div>
      )}

      {/* Add contact modal */}
      {formOpen && (
        <ContactForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={async (data) => {
            await createContact(data)
          }}
        />
      )}
    </div>
  )
}
