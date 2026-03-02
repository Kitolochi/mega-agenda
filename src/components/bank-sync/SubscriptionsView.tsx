import { useState, useMemo } from 'react'
import type { BankTransaction, BankAccount } from '../../types'
import { categorizeTransaction, getCategoryInfo, normalizeAmount } from '../../utils/categoryMapping'

interface SubscriptionsViewProps {
  transactions: BankTransaction[]
  accounts: BankAccount[]
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface DetectedSubscription {
  merchant: string
  amount: number         // avg amount in cents (absolute)
  frequency: 'monthly' | 'yearly' | 'weekly' | 'irregular'
  lastCharge: string     // YYYY-MM-DD
  nextExpected: string   // YYYY-MM-DD estimate
  charges: { date: string; amount: number }[]
  categoryKey: string
  active: boolean        // charged within expected window
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function detectFrequency(intervals: number[]): 'monthly' | 'yearly' | 'weekly' | 'irregular' {
  if (intervals.length === 0) return 'irregular'
  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length
  if (avg >= 5 && avg <= 10) return 'weekly'
  if (avg >= 25 && avg <= 40) return 'monthly'
  if (avg >= 340 && avg <= 400) return 'yearly'
  return 'irregular'
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  irregular: 'Irregular',
}

const FREQ_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 31,
  yearly: 365,
  irregular: 31,
}

function detectSubscriptions(
  transactions: BankTransaction[],
  acctTypeMap: Record<string, BankAccount['accountType']>,
): DetectedSubscription[] {
  // Group debits by normalized merchant
  const groups: Record<string, { date: string; amount: number; desc: string; merchant?: string; category?: string }[]> = {}

  for (const tx of transactions) {
    const norm = normalizeAmount(tx.amount, acctTypeMap[tx.accountId])
    if (norm >= 0) continue // only spending (normalized debits)
    const key = (tx.merchant || tx.description).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
    if (!key) continue
    if (!groups[key]) groups[key] = []
    groups[key].push({
      date: tx.date,
      amount: Math.abs(norm),
      desc: tx.description,
      merchant: tx.merchant,
      category: tx.category,
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const subs: DetectedSubscription[] = []

  for (const [, charges] of Object.entries(groups)) {
    if (charges.length < 2) continue // need at least 2 charges to detect pattern

    // Sort by date ascending
    charges.sort((a, b) => a.date.localeCompare(b.date))

    // Check amount consistency — subscription amounts should be similar
    const amounts = charges.map(c => c.amount)
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length
    const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.15)
    if (!amountVariance) continue // too much price variation

    // Check interval consistency
    const intervals: number[] = []
    for (let i = 1; i < charges.length; i++) {
      intervals.push(daysBetween(charges[i].date, charges[i - 1].date))
    }

    const freq = detectFrequency(intervals)

    // For keyword-matched subscriptions, allow irregular; for others require regular pattern
    const last = charges[charges.length - 1]
    const catKey = categorizeTransaction(last.desc, last.merchant, -last.amount, last.category)
    const isSubKeyword = catKey === 'subscriptions'

    if (!isSubKeyword && freq === 'irregular') continue
    if (!isSubKeyword && charges.length < 3) continue // need 3+ for non-keyword detection

    const merchantName = last.merchant || last.desc
    const lastCharge = last.date
    const expectedInterval = FREQ_DAYS[freq]
    const nextExpected = addDays(lastCharge, expectedInterval)
    const daysSinceLast = daysBetween(today, lastCharge)
    const active = daysSinceLast <= expectedInterval * 1.5

    subs.push({
      merchant: merchantName,
      amount: Math.round(avgAmount),
      frequency: freq,
      lastCharge,
      nextExpected,
      charges: charges.map(c => ({ date: c.date, amount: c.amount })),
      categoryKey: catKey,
      active,
    })
  }

  // Sort: active first, then by amount descending
  return subs.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return b.amount - a.amount
  })
}

export default function SubscriptionsView({ transactions, accounts }: SubscriptionsViewProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const acctTypeMap = useMemo(() => {
    const m: Record<string, BankAccount['accountType']> = {}
    for (const a of accounts) m[a.id] = a.accountType
    return m
  }, [accounts])

  const subscriptions = useMemo(() => detectSubscriptions(transactions, acctTypeMap), [transactions, acctTypeMap])

  const active = subscriptions.filter(s => s.active)
  const inactive = subscriptions.filter(s => !s.active)

  const monthlyTotal = useMemo(() => {
    return active.reduce((sum, s) => {
      if (s.frequency === 'weekly') return sum + s.amount * 4.33
      if (s.frequency === 'yearly') return sum + s.amount / 12
      return sum + s.amount
    }, 0)
  }, [active])

  const yearlyTotal = monthlyTotal * 12

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Active</p>
          <p className="text-lg font-semibold text-white">{active.length}</p>
          <p className="text-[10px] text-muted">subscriptions</p>
        </div>
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Monthly Cost</p>
          <p className="text-lg font-semibold text-accent-red">${formatCents(Math.round(monthlyTotal))}</p>
          <p className="text-[10px] text-muted">estimated</p>
        </div>
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl px-4 py-3">
          <p className="text-[10px] text-muted uppercase tracking-wider">Yearly Cost</p>
          <p className="text-lg font-semibold text-accent-red">${formatCents(Math.round(yearlyTotal))}</p>
          <p className="text-[10px] text-muted">projected</p>
        </div>
      </div>

      {/* Active subscriptions */}
      {active.length > 0 ? (
        <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.04]">
            <span className="text-[10px] text-muted uppercase tracking-wider">Active Subscriptions</span>
          </div>
          {active.map(sub => {
            const cat = getCategoryInfo(sub.categoryKey)
            const isExpanded = expanded === sub.merchant
            return (
              <div key={sub.merchant}>
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : sub.merchant)}
                >
                  {/* Color dot */}
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colorHex }} />

                  {/* Merchant + frequency */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{sub.merchant}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted">{FREQ_LABELS[sub.frequency]}</span>
                      <span className="text-[10px] text-muted/40">|</span>
                      <span className="text-[10px] text-muted">Last: {sub.lastCharge}</span>
                      {sub.frequency !== 'irregular' && (
                        <>
                          <span className="text-[10px] text-muted/40">|</span>
                          <span className="text-[10px] text-muted">Next: ~{sub.nextExpected}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Category badge */}
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0"
                    style={{ backgroundColor: cat.colorHex + '20', color: cat.colorHex }}
                  >
                    {cat.name}
                  </span>

                  {/* Amount */}
                  <span className="text-sm font-medium text-accent-red flex-shrink-0 w-20 text-right">
                    ${formatCents(sub.amount)}
                  </span>

                  {/* Expand chevron */}
                  <svg
                    className={`w-3.5 h-3.5 text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                {/* Expanded charge history */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 bg-white/[0.01]">
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Charge History ({sub.charges.length})</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {[...sub.charges].reverse().map((c, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-2/50">
                          <span className="text-[11px] text-muted">{c.date}</span>
                          <span className="text-[11px] text-white font-medium">${formatCents(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-sm text-muted">No subscriptions detected</p>
          <p className="text-xs text-muted/60 mt-1">Recurring charges will appear here after syncing more transactions</p>
        </div>
      )}

      {/* Inactive / cancelled */}
      {inactive.length > 0 && (
        <div>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white/70 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showInactive ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
            {inactive.length} possibly cancelled or inactive
          </button>

          {showInactive && (
            <div className="mt-2 bg-surface-2/30 border border-white/[0.04] rounded-xl overflow-hidden">
              {inactive.map(sub => {
                const cat = getCategoryInfo(sub.categoryKey)
                return (
                  <div key={sub.merchant} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0 opacity-60">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colorHex }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{sub.merchant}</p>
                      <span className="text-[10px] text-muted">Last charged: {sub.lastCharge}</span>
                    </div>
                    <span className="text-[10px] text-muted flex-shrink-0">{sub.charges.length} charges</span>
                    <span className="text-sm font-medium text-muted flex-shrink-0 w-20 text-right">
                      ${formatCents(sub.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted/50 text-center">
        Detected from transaction patterns. Some subscriptions may not appear if there aren't enough charges yet.
      </p>
    </div>
  )
}
