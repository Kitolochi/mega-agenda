import { NetworkContact } from '../../types'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import ContactAvatar from './ContactAvatar'

interface ContactCardProps {
  contact: NetworkContact
  onClick: () => void
}

export default function ContactCard({ contact, onClick }: ContactCardProps) {
  return (
    <Card variant="glass" className="p-3 hover:bg-white/[0.04]" onClick={onClick}>
      <div className="flex items-start gap-3">
        <ContactAvatar name={contact.name} color={contact.avatarColor} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{contact.name}</p>
          {(contact.role || contact.company) && (
            <p className="text-[11px] text-muted truncate">
              {contact.role}{contact.role && contact.company ? ' at ' : ''}{contact.company}
            </p>
          )}
          {contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {contact.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="default">{tag}</Badge>
              ))}
              {contact.tags.length > 3 && (
                <Badge variant="default">+{contact.tags.length - 3}</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
