import { useState } from 'react'
import type { BankProvider } from '../../types'

interface ConnectBankDialogProps {
  open: boolean
  onClose: () => void
  onConnected: () => void
}

type Step = 'choose' | 'simplefin' | 'teller' | 'connecting' | 'done' | 'error'

export default function ConnectBankDialog({ open, onClose, onConnected }: ConnectBankDialogProps) {
  const [step, setStep] = useState<Step>('choose')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const handleConnect = async (provider: BankProvider) => {
    if (!token.trim()) {
      setError('Please enter a token')
      return
    }

    setStep('connecting')
    setError('')

    try {
      await window.electronAPI.connectBank(provider, token.trim())
      setStep('done')
      setTimeout(() => {
        onConnected()
        handleClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Connection failed')
      setStep('error')
    }
  }

  const handleClose = () => {
    setStep('choose')
    setToken('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-surface-2 border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-emerald/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Connect Bank</h2>
                <p className="text-xs text-muted">Link your accounts for live balances</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm text-white/60 mb-4">Choose how to connect your bank accounts:</p>

              <button
                onClick={() => setStep('simplefin')}
                className="w-full p-4 rounded-xl bg-surface-3/50 border border-white/[0.06] hover:border-accent-emerald/30 hover:bg-surface-3 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center text-accent-emerald group-hover:bg-accent-emerald/20 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">SimpleFIN Bridge</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-emerald/20 text-accent-emerald font-medium">Recommended</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">16,000+ banks via MX &middot; $15/year &middot; Read-only</p>
                  </div>
                  <svg className="w-4 h-4 text-muted group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => setStep('teller')}
                className="w-full p-4 rounded-xl bg-surface-3/50 border border-white/[0.06] hover:border-accent-blue/30 hover:bg-surface-3 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue group-hover:bg-accent-blue/20 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">Teller</span>
                    <p className="text-xs text-muted mt-0.5">Direct bank connections &middot; Free &middot; Real-time</p>
                  </div>
                  <svg className="w-4 h-4 text-muted group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </button>
            </div>
          )}

          {step === 'simplefin' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-white/70 mb-3">
                  1. Go to <button onClick={() => window.electronAPI.openExternal('https://beta-bridge.simplefin.org')} className="text-accent-emerald hover:underline">simplefin.org</button> and create an account ($15/year)
                </p>
                <p className="text-sm text-white/70 mb-3">
                  2. Connect your banks through their portal
                </p>
                <p className="text-sm text-white/70 mb-4">
                  3. Generate a <strong className="text-white">Setup Token</strong> and paste it below:
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Setup Token</label>
                <textarea
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste your SimpleFIN setup token..."
                  className="w-full bg-surface-1 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/40 resize-none h-20 font-mono text-xs"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-accent-red">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep('choose'); setToken(''); setError('') }} className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-white bg-surface-3/50 hover:bg-surface-3 border border-white/[0.06] transition-all">
                  Back
                </button>
                <button
                  onClick={() => handleConnect('simplefin')}
                  disabled={!token.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/30 border border-accent-emerald/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Connect via SimpleFIN
                </button>
              </div>
            </div>
          )}

          {step === 'teller' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-white/70 mb-3">
                  1. Get your Teller access token from <button onClick={() => window.electronAPI.openExternal('https://teller.io')} className="text-accent-blue hover:underline">teller.io</button>
                </p>
                <p className="text-sm text-white/70 mb-4">
                  2. Paste your <strong className="text-white">Access Token</strong> below:
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Access Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Paste your Teller access token..."
                  className="w-full bg-surface-1 border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-blue/40 font-mono text-xs"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-accent-red">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setStep('choose'); setToken(''); setError('') }} className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-white bg-surface-3/50 hover:bg-surface-3 border border-white/[0.06] transition-all">
                  Back
                </button>
                <button
                  onClick={() => handleConnect('teller')}
                  disabled={!token.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 border border-accent-blue/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Connect via Teller
                </button>
              </div>
            </div>
          )}

          {step === 'connecting' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-accent-blue/30 border-t-accent-blue animate-spin" />
              <p className="text-sm text-white/70">Connecting and syncing accounts...</p>
              <p className="text-xs text-muted">This may take a moment</p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-accent-emerald/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Connected!</p>
              <p className="text-xs text-muted">Your accounts are now syncing</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="w-12 h-12 rounded-full bg-accent-red/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-white">Connection Failed</p>
                <p className="text-xs text-accent-red text-center max-w-xs">{error}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setStep('choose'); setError('') }} className="flex-1 px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-white bg-surface-3/50 hover:bg-surface-3 border border-white/[0.06] transition-all">
                  Try Again
                </button>
                <button onClick={handleClose} className="px-4 py-2 rounded-lg text-xs font-medium text-muted hover:text-white bg-surface-3/50 hover:bg-surface-3 border border-white/[0.06] transition-all">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
