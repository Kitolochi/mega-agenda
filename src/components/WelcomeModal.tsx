import { useState } from 'react'

interface WelcomeModalProps {
  onDismiss: () => void
}

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    title: 'Dashboard & Tasks',
    desc: 'Recurring daily tasks, categories, streaks, and a Pomodoro timer. Press N to add a task anywhere.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    color: 'text-accent-emerald',
    bg: 'bg-accent-emerald/10',
    title: 'Roadmap & Goals',
    desc: 'Set life goals, auto-research topics with AI, generate action plans, then launch parallel agents to execute tasks.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    title: 'AI Agents & Workspace',
    desc: 'Each goal gets a git repo. Agents are routed by type (research, code, writing) and share a workspace so they build on each other\'s work.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    title: 'Chat & Smart Query',
    desc: 'Chat with Claude using your full context. Use Insights buttons to ask "What should I prioritize this week?" across all your data.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    title: 'Context & Memories',
    desc: 'A markdown knowledge base at ~/.claude/memory/ with RAG search. Memories auto-extract from chats, journals, and completed agent tasks.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    title: 'Journal & Reviews',
    desc: 'Daily notes, AI morning briefings, and weekly reviews. Press J to jump to your journal anytime.',
  },
]

const shortcuts = [
  { key: 'D', label: 'Dashboard' },
  { key: 'T', label: 'Tasks' },
  { key: 'J', label: 'Journal' },
  { key: 'H', label: 'Chat' },
  { key: 'R', label: 'Roadmap' },
  { key: 'N', label: 'New Task' },
  { key: 'C', label: 'Terminal' },
  { key: 'P', label: 'Pomodoro' },
]

export default function WelcomeModal({ onDismiss }: WelcomeModalProps) {
  const [page, setPage] = useState(0)
  const totalPages = 2

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card rounded-2xl w-full max-w-md shadow-2xl shadow-black/40 max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="font-display font-bold text-lg text-white/90">
            {page === 0 ? 'Welcome to Mega Agenda' : 'Keyboard Shortcuts'}
          </h2>
          <p className="text-xs text-muted mt-1">
            {page === 0 ? 'Your AI-powered life management system' : 'Navigate fast with single-key shortcuts'}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 overflow-y-auto max-h-[55vh]">
          {page === 0 ? (
            <div className="space-y-2.5">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface-2/40">
                  <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center flex-shrink-0 ${f.color}`}>
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-xs font-semibold ${f.color}`}>{f.title}</h3>
                    <p className="text-[10px] text-muted/80 leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map(s => (
                  <div key={s.key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-2/40">
                    <kbd className="w-6 h-6 rounded-md bg-surface-3 border border-white/[0.08] flex items-center justify-center text-[10px] font-mono font-bold text-white/70">
                      {s.key}
                    </kbd>
                    <span className="text-[11px] text-white/70">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-surface-2/30 px-3 py-2.5">
                <p className="text-[10px] text-muted/70 leading-relaxed">
                  Shortcuts work everywhere except the terminal and text inputs. Press <kbd className="px-1 py-0.5 rounded bg-surface-3 text-[9px] font-mono text-white/60 border border-white/[0.06]">Esc</kbd> to close modals and go back.
                </p>
              </div>
              <div className="rounded-lg bg-accent-blue/5 border border-accent-blue/15 px-3 py-2.5">
                <p className="text-[10px] text-accent-blue/80 leading-relaxed">
                  To get started: add a Claude API key in Settings, create goals in Roadmap, then use "Find Topics" and "Research All" to build your knowledge base.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between">
          {/* Page dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === page ? 'bg-accent-blue w-4' : 'bg-white/20 hover:bg-white/30'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {page < totalPages - 1 ? (
              <button
                onClick={() => setPage(page + 1)}
                className="px-4 py-1.5 rounded-lg bg-accent-blue/15 text-accent-blue text-[11px] font-medium hover:bg-accent-blue/25 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onDismiss}
                className="px-4 py-1.5 rounded-lg bg-accent-blue text-white text-[11px] font-medium hover:bg-accent-blue/90 transition-all"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
