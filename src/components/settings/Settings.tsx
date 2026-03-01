import AIProviderSettings from './AIProviderSettings'
import CategoryManager from './CategoryManager'
import TwitterSettings from './TwitterSettings'
import FeedSettings from './FeedSettings'

const SHORTCUTS = [
  { key: 'N', label: 'New task' },
  { key: 'D', label: 'Dashboard' },
  { key: 'T', label: 'Tasks' },
  { key: 'L', label: 'List' },
  { key: 'J', label: 'Journal' },
  { key: 'F', label: 'Feed' },
  { key: 'M', label: 'Social' },
  { key: 'H', label: 'Chat' },
  { key: 'S', label: 'Settings' },
  { key: 'C', label: 'Code' },
  { key: 'V', label: 'Voice' },
  { key: 'P', label: 'Focus timer' },
  { key: '1-7', label: 'Select category' },
  { key: 'Esc', label: 'Back / Close' },
]

export default function Settings() {
  return (
    <div className="h-full overflow-auto p-5">
      <div className="text-center mb-5 animate-stagger-in" style={{ animationDelay: '0ms' }}>
        <h2 className="font-display font-semibold text-sm gradient-text">Settings</h2>
      </div>

      {/* AI Provider */}
      <AIProviderSettings />

      {/* Keyboard Shortcuts */}
      <div className="mb-6 animate-stagger-in" style={{ animationDelay: '120ms' }}>
        <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Keyboard Shortcuts</label>
        <div className="glass-card rounded-xl p-3 hover-lift">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="min-w-[28px] px-1.5 py-0.5 rounded-md bg-surface-3 border border-white/[0.06] text-white/50 font-mono text-[10px] text-center">
                  {s.key}
                </kbd>
                <span className="text-[11px] text-white/60">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <CategoryManager />

      {/* Twitter / X Integration */}
      <TwitterSettings />

      {/* Feed Sources */}
      <FeedSettings />
    </div>
  )
}
