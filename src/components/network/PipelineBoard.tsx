import { useState, useEffect, useMemo } from 'react'
import { PipelineCard } from '../../types'
import { useNetworkStore } from '../../store'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import PipelineColumn from './PipelineColumn'
import PipelineSelector from './PipelineSelector'
import PipelineCardForm from './PipelineCardForm'

export default function PipelineBoard() {
  const {
    contacts, pipelines, pipelineCards,
    selectedPipelineId, selectPipeline,
    createPipeline, deletePipeline, ensureDefaultPipeline,
    createPipelineCard, updatePipelineCard, movePipelineCard, deletePipelineCard,
  } = useNetworkStore()

  const [cardFormOpen, setCardFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<PipelineCard | undefined>()

  useEffect(() => {
    ensureDefaultPipeline()
  }, [ensureDefaultPipeline])

  const activePipeline = pipelines.find(p => p.id === selectedPipelineId)
  const stages = activePipeline?.stages || []

  const cardsByStage = useMemo(() => {
    const map: Record<string, PipelineCard[]> = {}
    stages.forEach(s => { map[s] = [] })
    pipelineCards
      .filter(c => c.pipelineId === selectedPipelineId)
      .forEach(c => {
        if (map[c.stage]) map[c.stage].push(c)
      })
    return map
  }, [pipelineCards, selectedPipelineId, stages])

  const handleEdit = (card: PipelineCard) => {
    setEditingCard(card)
    setCardFormOpen(true)
  }

  const handleSaveCard = async (data: { contactId: string; pipelineId: string; stage: string; title: string; description: string; value: string }) => {
    if (editingCard) {
      await updatePipelineCard(editingCard.id, data)
    } else {
      await createPipelineCard(data)
    }
    setEditingCard(undefined)
  }

  if (!activePipeline) {
    return (
      <div className="p-6">
        <EmptyState title="No pipeline selected" description="Create a pipeline to get started" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <PipelineSelector
          pipelines={pipelines}
          selectedId={selectedPipelineId}
          onSelect={selectPipeline}
          onCreate={async (name, stgs) => {
            const p = await createPipeline({ name, stages: stgs })
            selectPipeline(p.id)
          }}
          onDelete={deletePipeline}
        />
        <Button variant="primary" size="sm" onClick={() => { setEditingCard(undefined); setCardFormOpen(true) }}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Card
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => (
          <PipelineColumn
            key={stage}
            stage={stage}
            cards={cardsByStage[stage] || []}
            contacts={contacts}
            stages={stages}
            onMove={movePipelineCard}
            onEdit={handleEdit}
            onDelete={deletePipelineCard}
          />
        ))}
      </div>

      {/* Card form modal */}
      {cardFormOpen && (
        <PipelineCardForm
          open={cardFormOpen}
          onClose={() => { setCardFormOpen(false); setEditingCard(undefined) }}
          onSave={handleSaveCard}
          contacts={contacts}
          pipelineId={selectedPipelineId!}
          stages={stages}
          card={editingCard}
        />
      )}
    </div>
  )
}
