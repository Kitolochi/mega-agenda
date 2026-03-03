import { ContactInteraction, InteractionType } from '../../types'

const TYPE_CONFIG: Record<InteractionType, { icon: React.ReactNode; label: string; color: string }> = {
  call: {
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    label: 'Call',
    color: 'text-accent-blue',
  },
  email: {
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    label: 'Email',
    color: 'text-accent-purple',
  },
  meeting: {
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    label: 'Meeting',
    color: 'text-accent-emerald',
  },
  message: {
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    label: 'Message',
    color: 'text-accent-amber',
  },
  note: {
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    label: 'Note',
    color: 'text-white/50',
  },
}

interface InteractionItemProps {
  interaction: ContactInteraction
  onDelete: (id: string) => void
}

export default function InteractionItem({ interaction, onDelete }: InteractionItemProps) {
  const config = TYPE_CONFIG[interaction.type]
  const date = new Date(interaction.date)
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0 group">
      <div className={`mt-0.5 ${config.color}`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-white/80">{interaction.subject}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 ${config.color}`}>
            {config.label}
          </span>
        </div>
        {interaction.notes && (
          <p className="text-[11px] text-muted line-clamp-2">{interaction.notes}</p>
        )}
        <span className="text-[10px] text-muted/60 mt-1 block">{formatted}</span>
      </div>
      <button
        onClick={() => onDelete(interaction.id)}
        className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent-red transition-all p-1"
        title="Delete"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
