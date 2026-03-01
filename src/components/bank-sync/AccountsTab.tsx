import { useState, useEffect, useCallback } from 'react'
import type { BankConnection, BankAccount, BankTransaction } from '../../types'
import ConnectBankDialog from './ConnectBankDialog'
import ConnectionStatus from './ConnectionStatus'
import DebtSummary from './DebtSummary'

type ViewSection = 'overview' | 'transactions'

export default function AccountsTab() {
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [showConnect, setShowConnect] = useState(false)
  const [activeSection, setActiveSection] = useState<ViewSection>('overview')
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>()

  const loadData = useCallback(async () => {
    try {
      const [conns, accts, txs] = await Promise.all([
        window.electronAPI.getBankConnections(),
        window.electronAPI.getBankAccounts(),
        window.electronAPI.getBankTransactions(selectedAccountId, 50),
      ])
      setConnections(conns)
      setAccounts(accts)
      setTransactions(txs)
    } catch {
      // Silently fail
    }
  }, [selectedAccountId])

  useEffect(() => { loadData() }, [loadData])

  const handleSync = async (connectionId: string) => {
    try {
      await window.electronAPI.syncBankConnection(connectionId)
      await loadData()
    } catch {
      await loadData() // Reload to show error state
    }
  }

  const handleDelete = async (connectionId: string) => {
    await window.electronAPI.deleteBankConnection(connectionId)
    await loadData()
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-emerald/20 flex items-center justify-center text-accent-emerald">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Bank Accounts</h1>
            <p className="text-xs text-muted">
              {accounts.length > 0
                ? `${accounts.length} account${accounts.length !== 1 ? 's' : ''} connected`
                : 'Connect your bank to see live balances'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/30 border border-accent-emerald/20 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Connect Bank
        </button>
      </div>

      {/* Section tabs */}
      {accounts.length > 0 && (
        <div className="flex gap-2">
          {([
            { id: 'overview' as const, label: 'Overview' },
            { id: 'transactions' as const, label: 'Transactions' },
          ]).map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeSection === s.id
                  ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/20'
                  : 'bg-surface-2/50 text-muted hover:text-white/70 hover:bg-surface-2 border border-white/[0.06]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Debt summary */}
          {accounts.length > 0 && <DebtSummary />}

          {/* Connections */}
          {connections.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Connections</h2>
              <div className="space-y-2">
                {connections.map(conn => (
                  <ConnectionStatus
                    key={conn.id}
                    connection={conn}
                    onSync={handleSync}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {connections.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-2/80 border border-white/[0.06] flex items-center justify-center">
                <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-sm font-medium text-white mb-1">No banks connected</h3>
                <p className="text-xs text-muted max-w-xs">
                  Connect your Discover, Truliant, Capital One, or other bank accounts to see your current debt and balances in real time.
                </p>
              </div>
              <button
                onClick={() => setShowConnect(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent-emerald/20 text-accent-emerald hover:bg-accent-emerald/30 border border-accent-emerald/20 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Connect Your First Bank
              </button>
            </div>
          )}
        </div>
      )}

      {activeSection === 'transactions' && (
        <div className="space-y-3">
          {/* Account filter */}
          {accounts.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedAccountId(undefined)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  !selectedAccountId
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                    : 'bg-surface-2/50 text-muted hover:text-white/70 border border-white/[0.06]'
                }`}
              >
                All
              </button>
              {accounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccountId(a.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    selectedAccountId === a.id
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                      : 'bg-surface-2/50 text-muted hover:text-white/70 border border-white/[0.06]'
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}

          {/* Transaction list */}
          {transactions.length > 0 ? (
            <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 border-b border-white/[0.04] text-[10px] text-muted uppercase tracking-wider">
                <span>Description</span>
                <span>Date</span>
                <span className="text-right">Amount</span>
              </div>
              {transactions.map(tx => (
                <div key={tx.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{tx.merchant || tx.description}</p>
                    {tx.merchant && tx.description !== tx.merchant && (
                      <p className="text-[10px] text-muted truncate">{tx.description}</p>
                    )}
                    {tx.pending && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-accent-amber/20 text-accent-amber">Pending</span>
                    )}
                  </div>
                  <span className="text-xs text-muted self-center whitespace-nowrap">{tx.date}</span>
                  <span className={`text-sm font-medium self-center text-right ${tx.amount < 0 ? 'text-accent-red' : 'text-accent-emerald'}`}>
                    {tx.amount < 0 ? '-' : '+'}${formatCents(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-muted">No transactions yet</p>
              <p className="text-xs text-muted/60 mt-1">Transactions will appear after syncing</p>
            </div>
          )}
        </div>
      )}

      <ConnectBankDialog
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onConnected={loadData}
      />
    </div>
  )
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
