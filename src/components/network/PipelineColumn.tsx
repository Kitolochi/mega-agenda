import { PipelineCard, NetworkContact } from '../../types'
import PipelineCardItem from './PipelineCardItem'

interface PipelineColumnProps {
  stage: string
  cards: PipelineCard[]
  contacts: NetworkContact[]
  stages: string[]
  onMove: (id: string, stage: string) => void
  onEdit: (card: PipelineCard) => void
  onDelete: (id: string) => void
}

export default function PipelineColumn({ stage, cards, contacts, stages, onMove, onEdit, onDelete }: PipelineColumnProps) {
  return (
    <div className="flex-1 min-w-[220px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="text-xs font-semibold text-white/70">{stage}</h3>
        <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
          {cards.length}
        </span>
      </div>
      <div className="space-y-2 min-h-[100px] bg-surface-1/30 rounded-xl p-2 border border-white/[0.03]">
        {cards.map(card => (
          <PipelineCardItem
            key={card.id}
            card={card}
            contact={contacts.find(c => c.id === card.contactId)}
            stages={stages}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[10px] text-muted/40">
            No cards
          </div>
        )}
      </div>
    </div>
  )
}
