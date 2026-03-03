import { PipelineCard, NetworkContact } from '../../types'
import ContactAvatar from './ContactAvatar'

interface PipelineCardItemProps {
  card: PipelineCard
  contact: NetworkContact | undefined
  stages: string[]
  onMove: (id: string, stage: string) => void
  onEdit: (card: PipelineCard) => void
  onDelete: (id: string) => void
}

export default function PipelineCardItem({ card, contact, stages, onMove, onEdit, onDelete }: PipelineCardItemProps) {
  const currentIdx = stages.indexOf(card.stage)
  const canMoveLeft = currentIdx > 0
  const canMoveRight = currentIdx < stages.length - 1

  return (
    <div className="bg-surface-2/80 border border-white/[0.06] rounded-lg p-3 group hover:border-white/[0.1] transition-all">
      <div className="flex items-start gap-2 mb-2">
        {contact && (
          <ContactAvatar name={contact.name} color={contact.avatarColor} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/90 truncate">{card.title}</p>
          {contact && (
            <p className="text-[10px] text-muted truncate">{contact.name}</p>
          )}
        </div>
      </div>

      {card.description && (
        <p className="text-[10px] text-muted line-clamp-2 mb-2">{card.description}</p>
      )}

      {card.value && (
        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent-emerald/15 text-accent-emerald mb-2">
          {card.value}
        </span>
      )}

      {/* Move buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          <button
            onClick={() => canMoveLeft && onMove(card.id, stages[currentIdx - 1])}
            disabled={!canMoveLeft}
            className="p-1 rounded text-muted hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-all"
            title="Move left"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => canMoveRight && onMove(card.id, stages[currentIdx + 1])}
            disabled={!canMoveRight}
            className="p-1 rounded text-muted hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-all"
            title="Move right"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(card)}
            className="p-1 rounded text-muted hover:text-white/80 hover:bg-white/[0.06] transition-all"
            title="Edit"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="p-1 rounded text-muted hover:text-accent-red hover:bg-white/[0.06] transition-all"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
