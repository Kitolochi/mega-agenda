import { useState, useMemo } from 'react'
import type { BankTransaction, BankAccount } from '../../types'
import DateRangeBar, { type DateRange, type DatePreset, getDefaultRange } from './DateRangeBar'
import { categorizeTransaction, getCategoryInfo, SPENDING_CATEGORIES, normalizeAmount } from '../../utils/categoryMapping'
import DonutChart, { type DonutSegment } from './DonutChart'

interface SpendingViewProps {
  transactions: BankTransaction[]
  accounts: BankAccount[]
  selectedAccountId: string | undefined
  onSelectAccount: (id: string | undefined) => void
  categoryOverrides: Record<string, string>
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function SpendingView({ transactions, accounts, selectedAccountId, onSelectAccount, categoryOverrides }: SpendingViewProps) {
  const [preset, setPreset] = useState<DatePreset>('3m')
  const [range, setRange] = useState<DateRange>(getDefaultRange('3m'))
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)

  // Build account type lookup for normalizing amounts
  const acctTypeMap = useMemo(() => {
    const m: Record<string, BankAccount['accountType']> = {}
    for (const a of accounts) m[a.id] = a.accountType
    return m
  }, [accounts])

  // Build a set of inter-account transfer IDs to exclude from spending.
  // Matches debit/credit pairs across accounts when:
  //   1. Same amount, within 1 day
  //   2. Account types form a valid transfer pair (e.g. checking → credit card)
  //   3. At least one side has a transfer-like description
  const transferIds = useMemo(() => {
    const ids = new Set<string>()

    const TRANSFER_KEYWORDS = [
      'payment', 'pymt', 'transfer', 'autopay', 'auto pay', 'bill pay',
      'external withdrawal', 'external deposit', 'online pymt',
      'capital one', 'discover', 'chase', 'citi', 'amex', 'wells fargo',
      'bank of america', 'truliant', 'credit card',
    ]

    function looksLikeTransfer(desc: string, merchant?: string): boolean {
      const text = `${merchant || ''} ${desc}`.toLowerCase()
      return TRANSFER_KEYWORDS.some(kw => text.includes(kw))
    }

    // Valid transfer directions: depository ↔ credit/loan, or depository ↔ depository
    const DEPOSITORY = new Set(['checking', 'savings'])
    const DEBT = new Set(['credit_card', 'loan', 'mortgage'])
    function isValidTransferPair(typeA?: string, typeB?: string): boolean {
      if (!typeA || !typeB) return false
      // Depository to/from debt account (card payments)
      if (DEPOSITORY.has(typeA) && DEBT.has(typeB)) return true
      if (DEBT.has(typeA) && DEPOSITORY.has(typeB)) return true
      // Depository to depository (internal transfers)
      if (DEPOSITORY.has(typeA) && DEPOSITORY.has(typeB)) return true
      return false
    }

    const normalized = transactions.map(tx => ({
      ...tx,
      norm: normalizeAmount(tx.amount, acctTypeMap[tx.accountId]),
    }))

    // Index credits (positive normalized) by abs amount
    const credits: Record<string, typeof normalized> = {}
    for (const tx of normalized) {
      if (tx.norm <= 0) continue
      const key = `${Math.abs(tx.norm)}`
      if (!credits[key]) credits[key] = []
      credits[key].push(tx)
    }

    for (const tx of normalized) {
      if (tx.norm >= 0) continue
      const absKey = `${Math.abs(tx.norm)}`
      const matches = credits[absKey]
      if (!matches) continue

      const txType = acctTypeMap[tx.accountId]
      for (const credit of matches) {
        if (credit.accountId === tx.accountId) continue
        const creditType = acctTypeMap[credit.accountId]

        // Must be a valid account type pair
        if (!isValidTransferPair(txType, creditType)) continue

        // Must be within 3 days (card payments can take a few days to post)
        const dayDiff = Math.abs(new Date(tx.date).getTime() - new Date(credit.date).getTime()) / 86400000
        if (dayDiff > 3) continue

        // At least one side must have a transfer-like description
        if (!looksLikeTransfer(tx.description, tx.merchant) &&
            !looksLikeTransfer(credit.description, credit.merchant)) continue

        ids.add(tx.id)
        ids.add(credit.id)
        break
      }
    }
    return ids
  }, [transactions, acctTypeMap])

  // Filter and categorize
  const { categoryData, topMerchants, totalSpending } = useMemo(() => {
    const catTotals: Record<string, { amount: number; count: number }> = {}
    const merchantTotals: Record<string, number> = {}

    for (const tx of transactions) {
      if (tx.date < range.start || tx.date > range.end) continue
      if (selectedAccountId && tx.accountId !== selectedAccountId) continue
      if (transferIds.has(tx.id)) continue // Skip inter-account transfers

      const norm = normalizeAmount(tx.amount, acctTypeMap[tx.accountId])
      if (norm >= 0) continue // Only spending (normalized debits)

      const absAmount = Math.abs(norm)
      const catKey = categoryOverrides[tx.id] || categorizeTransaction(tx.description, tx.merchant, norm, tx.category)

      // Skip income and transfers from analysis
      if (catKey === 'income' || catKey === 'transfer') continue

      if (!catTotals[catKey]) catTotals[catKey] = { amount: 0, count: 0 }
      catTotals[catKey].amount += absAmount
      catTotals[catKey].count++

      const merchantName = tx.merchant || tx.description
      merchantTotals[merchantName] = (merchantTotals[merchantName] || 0) + absAmount
    }

    const totalSpending = Object.values(catTotals).reduce((s, c) => s + c.amount, 0)

    const categoryData = Object.entries(catTotals)
      .map(([key, data]) => ({
        key,
        info: getCategoryInfo(key),
        ...data,
        pct: totalSpending > 0 ? data.amount / totalSpending : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    const topMerchants = Object.entries(merchantTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    return { categoryData, topMerchants, totalSpending }
  }, [transactions, range, selectedAccountId, transferIds, categoryOverrides])

  const donutSegments: DonutSegment[] = categoryData.map(c => ({
    key: c.key,
    label: c.info.name,
    value: c.amount,
    color: c.info.colorHex,
  }))

  const maxMerchant = topMerchants[0]?.amount || 1

  return (
    <div className="space-y-3">
      {/* Filters */}
      <DateRangeBar range={range} preset={preset} onPresetChange={setPreset} onRangeChange={setRange} />

      {accounts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
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
        </div>
      )}

      {/* Total spending header */}
      <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-5 py-4">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Total Spending</p>
        <p className="text-2xl font-bold text-accent-red">${formatCents(totalSpending)}</p>
        <p className="text-[10px] text-muted mt-0.5">
          {categoryData.reduce((s, c) => s + c.count, 0)} transactions across {categoryData.length} categories
        </p>
      </div>

      {totalSpending === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted">No spending data</p>
          <p className="text-xs text-muted/60 mt-1">Adjust the date range or sync your accounts</p>
        </div>
      ) : (
        <>
          {/* Donut + Category breakdown */}
          <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-4">Spending by Category</h3>
            <div className="flex items-start gap-6">
              {/* Donut */}
              <div className="flex-shrink-0">
                <DonutChart
                  segments={donutSegments}
                  total={totalSpending}
                  hoveredKey={hoveredCategory}
                  onHover={setHoveredCategory}
                  formatValue={formatCents}
                />
              </div>

              {/* Category list */}
              <div className="flex-1 space-y-1 min-w-0">
                {categoryData.map(c => (
                  <div
                    key={c.key}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      hoveredCategory === c.key ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                    } ${hoveredCategory && hoveredCategory !== c.key ? 'opacity-40' : ''}`}
                    onMouseEnter={() => setHoveredCategory(c.key)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.info.colorHex }} />
                    <span className="text-xs text-white flex-shrink-0 w-28 truncate">{c.info.name}</span>
                    <span className="text-[10px] text-muted flex-shrink-0 w-6 text-center">{c.count}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${c.pct * 100}%`,
                          backgroundColor: c.info.colorHex,
                          opacity: hoveredCategory && hoveredCategory !== c.key ? 0.3 : 1,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white flex-shrink-0 w-20 text-right">
                      ${formatCents(c.amount)}
                    </span>
                    <span className="text-[10px] text-muted flex-shrink-0 w-10 text-right">
                      {(c.pct * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top merchants */}
          {topMerchants.length > 0 && (
            <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-4">Top Merchants</h3>
              <div className="space-y-2">
                {topMerchants.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted w-4 text-right">{i + 1}</span>
                    <span className="text-xs text-white w-40 truncate">{m.name}</span>
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-rose rounded-full transition-all duration-300"
                        style={{ width: `${(m.amount / maxMerchant) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-white w-20 text-right">${formatCents(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
