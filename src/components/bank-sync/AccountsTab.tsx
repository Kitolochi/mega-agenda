import { useState, useEffect, useCallback } from 'react'
import type { BankConnection, BankAccount, BankTransaction } from '../../types'
import ConnectBankDialog from './ConnectBankDialog'
import ConnectionStatus from './ConnectionStatus'
import DebtSummary from './DebtSummary'
import StatementsView from './StatementsView'
import SpendingView from './SpendingView'

type ViewSection = 'overview' | 'statements' | 'spending'

export default function AccountsTab() {
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [showConnect, setShowConnect] = useState(false)
  const [activeSection, setActiveSection] = useState<ViewSection>('overview')
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>()
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [conns, accts, txs] = await Promise.all([
        window.electronAPI.getBankConnections(),
        window.electronAPI.getBankAccounts(),
        window.electronAPI.getBankTransactions(undefined, 10000),
      ])
      setConnections(conns)
      setAccounts(accts)
      setTransactions(txs)
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSync = async (connectionId: string) => {
    try {
      await window.electronAPI.syncBankConnection(connectionId)
      await loadData()
    } catch {
      await loadData() // Reload to show error state
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await window.electronAPI.syncAllBankConnections()
      await loadData()
    } catch {
      await loadData()
    } finally {
      setRefreshing(false)
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
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-surface-2/80 text-muted hover:text-white hover:bg-surface-3 border border-white/[0.06] transition-all disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
              {refreshing ? 'Syncing...' : 'Refresh'}
            </button>
          )}
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
      </div>

      {/* Section tabs */}
      {accounts.length > 0 && (
        <div className="flex gap-2">
          {([
            { id: 'overview' as const, label: 'Overview' },
            { id: 'statements' as const, label: 'Statements' },
            { id: 'spending' as const, label: 'Spending' },
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

      {activeSection === 'statements' && (
        <StatementsView
          transactions={transactions}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
        />
      )}

      {activeSection === 'spending' && (
        <SpendingView
          transactions={transactions}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
        />
      )}

      <ConnectBankDialog
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onConnected={loadData}
      />
    </div>
  )
}
