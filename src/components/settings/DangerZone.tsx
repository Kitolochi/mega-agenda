import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'

export default function DangerZone() {
  const [confirmText, setConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const CONFIRM_PHRASE = 'WIPE EVERYTHING'

  const handleWipe = async () => {
    if (confirmText !== CONFIRM_PHRASE) return
    setWiping(true)
    try {
      await window.electronAPI.systemWipe()
      // Reload the app after wipe
      window.location.reload()
    } catch (err) {
      console.error('Wipe failed:', err)
      setWiping(false)
    }
  }

  return (
    <div className="mb-6 animate-stagger-in" style={{ animationDelay: '300ms' }}>
      <label className="block text-[10px] uppercase tracking-widest text-red-400/60 font-display font-medium mb-2">
        Danger Zone
      </label>
      <div className="glass-card rounded-xl p-4 border border-red-500/10">
        {!showConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-white/70 font-medium">System Wipe</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                Delete all tasks, notes, roadmap, chat history, and settings. Backups will also be removed.
              </p>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-all"
            >
              <Trash2 size={11} />
              Wipe Data
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-red-400 font-medium">This cannot be undone</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  All your data will be permanently deleted including tasks, daily notes, journal entries,
                  roadmap goals, chat conversations, API keys, and all backups.
                </p>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-white/30 block mb-1">
                Type <span className="text-red-400 font-mono">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/15 focus:outline-none focus:border-red-500/40 font-mono"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setConfirmText('') }}
                className="px-3 py-1.5 rounded-lg text-[10px] text-white/40 hover:text-white/60 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                disabled={confirmText !== CONFIRM_PHRASE || wiping}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-500 transition-all"
              >
                <Trash2 size={11} />
                {wiping ? 'Wiping...' : 'Permanently Delete Everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
