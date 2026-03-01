import { useState, useEffect, useCallback } from 'react'
import type { BankAccount, BankConnection } from '../../types'

interface DebtSummaryProps {
  compact?: boolean
}

export default function DebtSummary({ compact = false }: DebtSummaryProps) {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [syncing, setSyncing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [accts, conns] = await Promise.all([
        window.electronAPI.getBankAccounts(),
        window.electronAPI.getBankConnections(),
      ])
      setAccounts(accts)
      setConnections(conns)
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    loadData()

    // Auto-sync if stale (> 1 hour)
    const activeConns = connections.filter(c => c.status === 'active')
    const stale = activeConns.some(c => {
      if (!c.lastSynced) return true
      return Date.now() - new Date(c.lastSynced).getTime() > 60 * 60 * 1000
    })
    if (stale && activeConns.length > 0) {
      window.electronAPI.syncAllBankConnections().then(loadData).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setSyncing(true)
    try {
      await window.electronAPI.syncAllBankConnections()
      await loadData()
    } finally {
      setSyncing(false)
    }
  }

  if (connections.length === 0) return null

  // Calculate debt (negative balances = credit/loan accounts)
  const debtAccounts = accounts.filter(a =>
    a.accountType === 'credit_card' || a.accountType === 'loan' || a.accountType === 'mortgage'
  )
  const totalDebt = debtAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0)

  // Calculate assets (positive balances)
  const assetAccounts = accounts.filter(a =>
    a.accountType === 'checking' || a.accountType === 'savings' || a.accountType === 'investment'
  )
  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.balance, 0)

  const lastSync = connections
    .filter(c => c.lastSynced)
    .sort((a, b) => (b.lastSynced || '').localeCompare(a.lastSynced || ''))[0]?.lastSynced

  if (compact) {
    return (
      <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-rose/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white">Current Debt</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30"
          >
            <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
        </div>

        {/* Total debt */}
        <div className="mb-3">
          <span className="text-2xl font-display font-bold text-accent-red">
            ${formatCents(totalDebt)}
          </span>
          {totalAssets > 0 && (
            <span className="text-xs text-muted ml-2">
              Assets: <span className="text-accent-emerald">${formatCents(totalAssets)}</span>
            </span>
          )}
        </div>

        {/* Per-account breakdown */}
        <div className="space-y-1.5">
          {debtAccounts.map(a => (
            <div key={a.id} className="flex items-center justify-between text-xs">
              <span className="text-muted truncate flex-1">{a.name}</span>
              <span className="text-accent-red font-medium ml-2">${formatCents(Math.abs(a.balance))}</span>
            </div>
          ))}
        </div>

        {lastSync && (
          <p className="text-[10px] text-muted/60 mt-2">
            Updated {formatTimeAgo(new Date(lastSync))}
          </p>
        )}
      </div>
    )
  }

  // Full view
  return (
    <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-rose/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Financial Overview</h3>
            <p className="text-xs text-muted">{accounts.length} accounts connected</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-white bg-surface-3/50 hover:bg-surface-3 border border-white/[0.06] transition-all disabled:opacity-30"
        >
          <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface-1/50 rounded-lg p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Total Debt</p>
          <p className="text-xl font-display font-bold text-accent-red">${formatCents(totalDebt)}</p>
        </div>
        <div className="bg-surface-1/50 rounded-lg p-3">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Total Assets</p>
          <p className="text-xl font-display font-bold text-accent-emerald">${formatCents(totalAssets)}</p>
        </div>
      </div>

      {/* Debt accounts */}
      {debtAccounts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Debt Accounts</p>
          <div className="space-y-2">
            {debtAccounts.map(a => (
              <AccountRow key={a.id} account={a} />
            ))}
          </div>
        </div>
      )}

      {/* Asset accounts */}
      {assetAccounts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Asset Accounts</p>
          <div className="space-y-2">
            {assetAccounts.map(a => (
              <AccountRow key={a.id} account={a} />
            ))}
          </div>
        </div>
      )}

      {lastSync && (
        <p className="text-[10px] text-muted/60 mt-3 text-right">
          Last synced {formatTimeAgo(new Date(lastSync))}
        </p>
      )}
    </div>
  )
}

function AccountRow({ account }: { account: BankAccount }) {
  const isDebt = account.accountType === 'credit_card' || account.accountType === 'loan' || account.accountType === 'mortgage'
  const displayBalance = Math.abs(account.balance)

  const typeLabels: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit_card: 'Credit Card',
    loan: 'Loan',
    mortgage: 'Mortgage',
    investment: 'Investment',
    other: 'Other',
  }

  return (
    <div className="flex items-center justify-between bg-surface-1/30 rounded-lg px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{account.name}</p>
        <p className="text-[10px] text-muted">{account.institution} &middot; {typeLabels[account.accountType] || account.accountType}</p>
      </div>
      <span className={`text-sm font-medium ml-3 ${isDebt ? 'text-accent-red' : 'text-accent-emerald'}`}>
        {isDebt ? '-' : ''}${formatCents(displayBalance)}
      </span>
    </div>
  )
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
