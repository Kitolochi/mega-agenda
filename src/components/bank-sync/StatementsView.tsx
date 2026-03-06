import { useState, useMemo, useRef, useEffect } from 'react'
import type { BankTransaction, BankAccount } from '../../types'
import DateRangeBar, { type DateRange, type DatePreset, getDefaultRange } from './DateRangeBar'
import { categorizeTransaction, getCategoryInfo, SPENDING_CATEGORIES, normalizeAmount } from '../../utils/categoryMapping'

interface StatementsViewProps {
  transactions: BankTransaction[]
  accounts: BankAccount[]
  selectedAccountId: string | undefined
  onSelectAccount: (id: string | undefined) => void
  categoryOverrides: Record<string, string>
  onCategoryOverride: (transactionId: string, categoryKey: string | null) => void
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ALL_CATEGORY_KEYS = Object.keys(SPENDING_CATEGORIES)

function CategoryBadge({
  txId,
  catKey,
  isOverridden,
  onOverride,
}: {
  txId: string
  catKey: string
  isOverridden: boolean
  onOverride: (transactionId: string, categoryKey: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cat = getCategoryInfo(catKey)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative self-center" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap cursor-pointer transition-all hover:brightness-125"
        style={{
          backgroundColor: cat.colorHex + '20',
          color: cat.colorHex,
          borderWidth: '1px',
          borderColor: isOverridden ? cat.colorHex + '60' : 'transparent',
        }}
      >
        {isOverridden && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: cat.colorHex }}
            title="Manually categorized"
          />
        )}
        {cat.name}
        <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-48 max-h-72 overflow-y-auto rounded-xl bg-surface-3 border border-white/[0.1] shadow-xl shadow-black/40 py-1">
          {isOverridden && (
            <button
              onClick={e => { e.stopPropagation(); onOverride(txId, null); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted hover:bg-white/[0.06] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              Reset to auto-detect
            </button>
          )}
          {ALL_CATEGORY_KEYS.map(key => {
            const info = getCategoryInfo(key)
            const isActive = key === catKey
            return (
              <button
                key={key}
                onClick={e => { e.stopPropagation(); onOverride(txId, key); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                  isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: info.colorHex }}
                />
                <span className="truncate">{info.name}</span>
                {isActive && (
                  <svg className="w-3 h-3 ml-auto flex-shrink-0 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function StatementsView({ transactions, accounts, selectedAccountId, onSelectAccount, categoryOverrides, onCategoryOverride }: StatementsViewProps) {
  const [preset, setPreset] = useState<DatePreset>('3m')
  const [range, setRange] = useState<DateRange>(getDefaultRange('3m'))
  const [search, setSearch] = useState('')
  const [showCount, setShowCount] = useState(50)

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase()
    return transactions
      .filter(tx => {
        if (tx.date < range.start || tx.date > range.end) return false
        if (selectedAccountId && tx.accountId !== selectedAccountId) return false
        if (searchLower) {
          const text = `${tx.merchant || ''} ${tx.description}`.toLowerCase()
          if (!text.includes(searchLower)) return false
        }
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, range, selectedAccountId, search])

  const acctTypeMap = useMemo(() => {
    const m: Record<string, BankAccount['accountType']> = {}
    for (const a of accounts) m[a.id] = a.accountType
    return m
  }, [accounts])

  const stats = useMemo(() => {
    let spending = 0
    let income = 0
    for (const tx of filtered) {
      const norm = normalizeAmount(tx.amount, acctTypeMap[tx.accountId])
      if (norm < 0) spending += Math.abs(norm)
      else income += norm
    }
    return { spending, income, net: income - spending }
  }, [filtered, acctTypeMap])

  const visible = filtered.slice(0, showCount)
  const hasMore = filtered.length > showCount

  return (
    <div className="space-y-3">
      {/* Filters row */}
      <DateRangeBar range={range} preset={preset} onPresetChange={setPreset} onRangeChange={setRange} />

      <div className="flex items-center gap-2 flex-wrap">
        {/* Account pills */}
        {accounts.length > 1 && (
          <>
            <button
              onClick={() => onSelectAccount(undefined)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                !selectedAccountId
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                  : 'bg-surface-2/50 text-muted hover:text-white/70 border border-white/[0.06]'
              }`}
            >
              All Accounts
            </button>
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => onSelectAccount(a.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  selectedAccountId === a.id
                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
                    : 'bg-surface-2/50 text-muted hover:text-white/70 border border-white/[0.06]'
                }`}
              >
                {a.name}
              </button>
            ))}
          </>
        )}

        {/* Search */}
        <div className="relative ml-auto">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-2/80 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder:text-muted/50 w-48 focus:outline-none focus:border-accent-blue/30"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Spending</p>
          <p className="text-lg font-semibold text-accent-red">${formatCents(stats.spending)}</p>
        </div>
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Income</p>
          <p className="text-lg font-semibold text-accent-emerald">${formatCents(stats.income)}</p>
        </div>
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Net</p>
          <p className={`text-lg font-semibold ${stats.net >= 0 ? 'text-accent-emerald' : 'text-accent-red'}`}>
            {stats.net < 0 ? '-' : '+'}${formatCents(Math.abs(stats.net))}
          </p>
        </div>
      </div>

      {/* Transaction table */}
      {visible.length > 0 ? (
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-white/[0.04] text-[10px] text-muted uppercase tracking-wider">
            <span>Description</span>
            <span>Category</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
          </div>
          {visible.map(tx => {
            const norm = normalizeAmount(tx.amount, acctTypeMap[tx.accountId])
            const overrideKey = categoryOverrides[tx.id]
            const autoKey = categorizeTransaction(tx.description, tx.merchant, norm, tx.category)
            const catKey = overrideKey || autoKey
            const isOverridden = !!overrideKey
            return (
              <div key={tx.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{tx.merchant || tx.description}</p>
                  {tx.merchant && tx.description !== tx.merchant && (
                    <p className="text-[10px] text-muted truncate">{tx.description}</p>
                  )}
                  {tx.pending && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-accent-amber/20 text-accent-amber">Pending</span>
                  )}
                </div>
                <CategoryBadge
                  txId={tx.id}
                  catKey={catKey}
                  isOverridden={isOverridden}
                  onOverride={onCategoryOverride}
                />
                <span className="text-xs text-muted self-center whitespace-nowrap">{tx.date}</span>
                <span className={`text-sm font-medium self-center text-right ${norm < 0 ? 'text-accent-red' : 'text-accent-emerald'}`}>
                  {norm < 0 ? '-' : '+'}${formatCents(Math.abs(norm))}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sm text-muted">No transactions found</p>
          <p className="text-xs text-muted/60 mt-1">
            {search ? 'Try a different search term' : 'Adjust the date range or sync your accounts'}
          </p>
        </div>
      )}

      {/* Show more */}
      {hasMore && (
        <button
          onClick={() => setShowCount(c => c + 50)}
          className="w-full py-2 text-xs text-accent-blue hover:text-accent-blue/80 bg-surface-2/30 border border-white/[0.04] rounded-xl transition-colors"
        >
          Show more ({filtered.length - showCount} remaining)
        </button>
      )}

      <p className="text-[10px] text-muted/50 text-center">
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
