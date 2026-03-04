import { useState, useEffect, useMemo, useCallback } from 'react'
import { useOutreachStore } from '../store/outreachStore'
import { cn } from '../utils/cn'
import { OnboardingWizard, TipsOverlay, OutreachSettingsPanel } from './OutreachOnboarding'
import type {
  OutreachBusiness,
  OutreachContact,
  OutreachMessage,
  OutreachBusinessStatus,
} from '../types'

const STATUS_COLORS: Record<OutreachBusinessStatus, string> = {
  'New': 'bg-accent-blue/20 text-accent-blue',
  'Contacted': 'bg-accent-amber/20 text-accent-amber',
  'Responded': 'bg-accent-emerald/20 text-accent-emerald',
  'Not Interested': 'bg-white/10 text-white/50',
  'Meeting Scheduled': 'bg-accent-purple/20 text-accent-purple',
}

const STATUS_DOT_COLORS: Record<OutreachBusinessStatus, string> = {
  'New': 'bg-accent-blue',
  'Contacted': 'bg-accent-amber',
  'Responded': 'bg-accent-emerald',
  'Not Interested': 'bg-white/30',
  'Meeting Scheduled': 'bg-accent-purple',
}

const ALL_STATUSES: OutreachBusinessStatus[] = ['New', 'Contacted', 'Responded', 'Not Interested', 'Meeting Scheduled']

const CATEGORIES = ['Marketing', 'Real Estate', 'Law', 'Medical', 'Dental', 'Fitness', 'Restaurant', 'Retail', 'Auto', 'Construction', 'Accounting', 'Other']

type SubView = 'businesses' | 'discover' | 'messages' | 'pipeline'

const SUB_TABS: { id: SubView; label: string }[] = [
  { id: 'businesses', label: 'Businesses' },
  { id: 'discover', label: 'Discover' },
  { id: 'messages', label: 'Messages' },
  { id: 'pipeline', label: 'Pipeline' },
]

interface AutoResearchProgress {
  phase: string
  status: string
  message: string
  [key: string]: any
}

export default function OutreachTab() {
  const { currentView, setView, fetchBusinesses, fetchPipelineStats, fetchTemplates } = useOutreachStore()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)
  const [researching, setResearching] = useState(false)
  const [researchProgress, setResearchProgress] = useState<AutoResearchProgress | null>(null)
  const [researchResult, setResearchResult] = useState<{ discovered: number; enriched: number; contactsFound: number; socialLinksFound: number } | null>(null)

  const checkOnboarding = useCallback(async () => {
    try {
      const [settings, count] = await Promise.all([
        window.electronAPI.getOutreachSettings(),
        window.electronAPI.getOutreachBusinessCount(),
      ])
      if (settings.onboarding_completed !== 'true' && count === 0) {
        setShowOnboarding(true)
      }
    } catch {
      // Settings IPC not available (e.g. mock mode), skip onboarding
    } finally {
      setCheckingOnboarding(false)
    }
  }, [])

  useEffect(() => {
    checkOnboarding()
    fetchBusinesses()
    fetchPipelineStats()
    fetchTemplates()
  }, [checkOnboarding, fetchBusinesses, fetchPipelineStats, fetchTemplates])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    fetchBusinesses()
    fetchPipelineStats()
  }, [fetchBusinesses, fetchPipelineStats])

  // Auto-research progress listener
  useEffect(() => {
    const unsub = window.electronAPI.onAutoResearchProgress((data) => {
      setResearchProgress(data)
    })
    return unsub
  }, [])

  const handleAutoResearch = useCallback(async () => {
    setResearching(true)
    setResearchProgress(null)
    setResearchResult(null)
    try {
      const result = await window.electronAPI.runAutoResearch()
      setResearchResult(result)
      fetchBusinesses()
      fetchPipelineStats()
    } finally {
      setResearching(false)
    }
  }, [fetchBusinesses, fetchPipelineStats])

  if (checkingOnboarding) {
    return (
      <div className="h-full flex items-center justify-center">
        <svg className="w-5 h-5 animate-spin text-muted" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Onboarding wizard overlay */}
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}

      {/* Settings panel overlay */}
      {showSettings && <OutreachSettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Tips overlay */}
      {showTips && <TipsOverlay onClose={() => setShowTips(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-emerald/30 to-accent-blue/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-display font-semibold text-white/90">Outreach</h2>
            <p className="text-[10px] text-muted">Business discovery & outreach pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAutoResearch}
            disabled={researching}
            title="Auto-Research: discover businesses, find contacts & social links"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
              researching
                ? 'bg-accent-emerald/10 text-accent-emerald/70 cursor-wait'
                : 'bg-gradient-to-r from-accent-emerald/20 to-accent-blue/20 text-accent-emerald hover:from-accent-emerald/30 hover:to-accent-blue/30 border border-accent-emerald/20'
            )}
          >
            {researching ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            )}
            {researching ? 'Researching...' : 'Auto-Research'}
          </button>
          <button
            onClick={() => setShowTips(true)}
            title="Outreach Tips"
            className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-white/70 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Outreach Settings"
            className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-white/70 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 mb-4">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium transition-all',
              currentView === tab.id
                ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/20'
                : 'bg-surface-2/50 text-muted hover:text-white/70 hover:bg-surface-2 border border-white/[0.06]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Auto-Research progress */}
      {(researching || researchResult) && (
        <div className="mb-4 p-3 rounded-xl bg-surface-1/50 border border-white/[0.06]">
          {researching && researchProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin text-accent-emerald" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-white/70">{researchProgress.message}</span>
                </div>
                <span className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded font-medium',
                  researchProgress.phase === 'discover' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-accent-purple/20 text-accent-purple'
                )}>
                  {researchProgress.phase === 'discover' ? 'Discovering' : 'Enriching'}
                </span>
              </div>
              {researchProgress.totalCategories && (
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-emerald rounded-full transition-all duration-500"
                    style={{ width: `${researchProgress.phase === 'discover'
                      ? (researchProgress.categoryIndex / researchProgress.totalCategories) * 50
                      : 50 + (researchProgress.current / researchProgress.total) * 50
                    }%` }}
                  />
                </div>
              )}
              {researchProgress.total && (
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-emerald rounded-full transition-all duration-500"
                    style={{ width: `${(researchProgress.current / researchProgress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {researching && !researchProgress && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-accent-emerald" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-white/70">Starting auto-research...</span>
            </div>
          )}
          {!researching && researchResult && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-white/70">
                  {researchResult.discovered} businesses found, {researchResult.enriched} enriched, {researchResult.contactsFound} contacts, {researchResult.socialLinksFound} social links
                </span>
              </div>
              <button
                onClick={() => setResearchResult(null)}
                className="text-[10px] text-muted hover:text-white/70 transition-all"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active sub-view */}
      <div className="flex-1 overflow-auto">
        {currentView === 'businesses' && <BusinessesView />}
        {currentView === 'discover' && <DiscoverPanel />}
        {currentView === 'messages' && <MessageComposer />}
        {currentView === 'pipeline' && <PipelineDashboard />}
      </div>
    </div>
  )
}

// ============================================================
// Businesses View — list + detail panel
// ============================================================

function BusinessesView() {
  const {
    businesses, filters, setFilter, selectedBusiness, setSelectedBusiness,
    loading, contacts, outreachHistory, loadingContacts, loadingHistory,
    fetchBusinesses,
  } = useOutreachStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    return businesses.filter(b => {
      if (filters.status && b.status !== filters.status) return false
      if (filters.category && b.category !== filters.category) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!b.name.toLowerCase().includes(q) && !b.category.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [businesses, filters])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(b => b.id)))
    }
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Business list */}
      <div className={cn('flex flex-col', selectedBusiness ? 'w-1/2' : 'w-full')}>
        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            placeholder="Search businesses..."
            className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button
            onClick={() => setFilter('status', '')}
            className={cn(
              'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
              !filters.status ? 'bg-accent-emerald/20 text-accent-emerald' : 'bg-surface-2 text-muted hover:text-white'
            )}
          >
            All
          </button>
          {ALL_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => setFilter('status', filters.status === status ? '' : status)}
              className={cn(
                'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                filters.status === status ? STATUS_COLORS[status] : 'bg-surface-2 text-muted hover:text-white'
              )}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {filters.category && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] text-muted">Category:</span>
            <span className="text-[10px] text-accent-blue">{filters.category}</span>
            <button
              onClick={() => setFilter('category', '')}
              className="p-0.5 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-surface-2 border border-white/[0.06]">
            <span className="text-[10px] text-muted">{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-all"
            >
              Clear
            </button>
          </div>
        )}

        {/* Table header */}
        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider border-b border-white/[0.06]">
          <input
            type="checkbox"
            checked={filtered.length > 0 && selectedIds.size === filtered.length}
            onChange={toggleSelectAll}
            className="w-3 h-3 rounded accent-accent-emerald"
          />
          <span className="flex-1">Business</span>
          <span className="w-20 text-center">Category</span>
          <span className="w-24 text-center">Status</span>
          <span className="w-16 text-center">Contacts</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <svg className="w-5 h-5 animate-spin text-muted" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-[11px] text-muted">No businesses found</p>
              <p className="text-[10px] text-muted/60 mt-1">Try adjusting your filters or discover new businesses</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(biz => (
                <div
                  key={biz.id}
                  onClick={() => setSelectedBusiness(selectedBusiness?.id === biz.id ? null : biz)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group',
                    selectedBusiness?.id === biz.id
                      ? 'bg-accent-emerald/10 border border-accent-emerald/20'
                      : 'hover:bg-surface-2/60 border border-transparent'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(biz.id)}
                    onChange={e => { e.stopPropagation(); toggleSelect(biz.id) }}
                    onClick={e => e.stopPropagation()}
                    className="w-3 h-3 rounded accent-accent-emerald"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-white/80 truncate">{biz.name}</div>
                    {biz.address && (
                      <div className="text-[9px] text-muted/50 truncate">{biz.address}</div>
                    )}
                  </div>
                  <span className="w-20 text-center">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted">{biz.category || '-'}</span>
                  </span>
                  <span className="w-24 text-center">
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded', STATUS_COLORS[biz.status])}>
                      {biz.status}
                    </span>
                  </span>
                  <span className="w-16 text-center text-[10px] text-muted">
                    {biz.phone ? '1+' : '0'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedBusiness && (
        <BusinessDetail
          business={selectedBusiness}
          contacts={contacts}
          history={outreachHistory}
          loadingContacts={loadingContacts}
          loadingHistory={loadingHistory}
          onClose={() => setSelectedBusiness(null)}
          onRefresh={() => fetchBusinesses()}
        />
      )}
    </div>
  )
}

// ============================================================
// Business Detail panel
// ============================================================

function BusinessDetail({
  business, contacts, history, loadingContacts, loadingHistory, onClose, onRefresh,
}: {
  business: OutreachBusiness
  contacts: OutreachContact[]
  history: OutreachMessage[]
  loadingContacts: boolean
  loadingHistory: boolean
  onClose: () => void
  onRefresh: () => void
}) {
  const [statusDropdown, setStatusDropdown] = useState(false)
  const { setView } = useOutreachStore()

  const handleStatusChange = async (status: OutreachBusinessStatus) => {
    await window.electronAPI.updateBusiness(business.id, { status })
    setStatusDropdown(false)
    onRefresh()
  }

  const handleEnrich = async () => {
    await window.electronAPI.enrichBusiness(business.id)
    onRefresh()
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return null
    const full = Math.floor(rating)
    const half = rating % 1 >= 0.5
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            className={cn('w-3 h-3', i < full ? 'text-accent-amber' : i === full && half ? 'text-accent-amber/50' : 'text-surface-3')}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="text-[9px] text-muted ml-1">{rating.toFixed(1)}</span>
        {business.reviewCount && (
          <span className="text-[9px] text-muted/50">({business.reviewCount})</span>
        )}
      </div>
    )
  }

  const socialIcons: { key: string; label: string; icon: JSX.Element }[] = [
    { key: 'linkedin', label: 'LinkedIn', icon: <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /> },
    { key: 'facebook', label: 'Facebook', icon: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /> },
    { key: 'instagram', label: 'Instagram', icon: <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" /> },
    { key: 'twitter', label: 'X', icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /> },
  ]

  return (
    <div className="w-1/2 bg-surface-1/50 rounded-xl border border-white/[0.06] p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white truncate">{business.name}</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Info section */}
      <div className="space-y-2 mb-4">
        {business.address && (
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-muted mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-[11px] text-white/60">{business.address}</span>
          </div>
        )}
        {business.website && (
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <button
              onClick={() => window.electronAPI.openExternal(business.website.startsWith('http') ? business.website : `https://${business.website}`)}
              className="text-[11px] text-accent-blue hover:text-accent-blue/80 transition-colors truncate"
            >
              {business.website}
            </button>
          </div>
        )}
        {business.phone && (
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <span className="text-[11px] text-white/60">{business.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded', STATUS_COLORS[business.status])}>
            {business.status}
          </span>
          {business.category && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted">{business.category}</span>
          )}
        </div>
        {renderStars(business.rating)}
      </div>

      {/* Social links */}
      {Object.keys(business.socialLinks || {}).length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          {socialIcons.map(({ key, label, icon }) => {
            const url = business.socialLinks?.[key]
            if (!url) return null
            return (
              <button
                key={key}
                onClick={() => window.electronAPI.openExternal(url)}
                title={label}
                className="w-7 h-7 rounded-lg bg-surface-3 hover:bg-surface-4 flex items-center justify-center text-muted hover:text-white transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">{icon}</svg>
              </button>
            )
          })}
        </div>
      )}

      {/* Contacts */}
      <div className="mb-4">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-2">Contacts</div>
        {loadingContacts ? (
          <div className="text-[10px] text-muted/50 py-2">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="text-[10px] text-muted/50 py-2">No contacts found</div>
        ) : (
          <div className="space-y-1.5">
            {contacts.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-2/50">
                <div className="w-6 h-6 rounded-full bg-accent-blue/20 flex items-center justify-center text-[9px] text-accent-blue font-medium flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/80 truncate">{c.name}</div>
                  <div className="text-[9px] text-muted/50 truncate">{c.title}</div>
                </div>
                {c.email && (
                  <button
                    onClick={() => window.electronAPI.openExternal(`mailto:${c.email}`)}
                    className="text-[9px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                    title={c.email}
                  >
                    email
                  </button>
                )}
                {c.linkedinUrl && (
                  <button
                    onClick={() => window.electronAPI.openExternal(c.linkedinUrl)}
                    className="text-[9px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                  >
                    LI
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outreach History */}
      <div className="mb-4">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-2">Outreach History</div>
        {loadingHistory ? (
          <div className="text-[10px] text-muted/50 py-2">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-[10px] text-muted/50 py-2">No outreach yet</div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-auto">
            {history.map(msg => (
              <div key={msg.id} className="px-2 py-1.5 rounded-lg bg-surface-2/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted">{msg.channel}</span>
                  <span className={cn(
                    'text-[9px] px-1 py-0.5 rounded',
                    msg.status === 'sent' ? 'bg-accent-blue/20 text-accent-blue'
                      : msg.status === 'responded' ? 'bg-accent-emerald/20 text-accent-emerald'
                      : 'bg-surface-3 text-muted'
                  )}>
                    {msg.status}
                  </span>
                </div>
                <div className="text-[10px] text-white/60 line-clamp-2">{msg.messageText}</div>
                {msg.sentAt && (
                  <div className="text-[8px] text-muted/40 mt-1">
                    {new Date(msg.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleEnrich}
          className="px-2.5 py-1.5 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 text-[10px] font-medium text-accent-purple transition-all"
        >
          Enrich
        </button>
        <button
          onClick={() => {
            useOutreachStore.getState().setSelectedBusiness(business)
            setView('messages')
          }}
          className="px-2.5 py-1.5 rounded-lg bg-accent-blue/20 hover:bg-accent-blue/30 text-[10px] font-medium text-accent-blue transition-all"
        >
          Compose Message
        </button>
        <div className="relative">
          <button
            onClick={() => setStatusDropdown(!statusDropdown)}
            className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-[10px] font-medium text-muted hover:text-white transition-all"
          >
            Update Status
          </button>
          {statusDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-surface-2 border border-white/[0.06] rounded-lg p-1 z-20 min-w-[140px]">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-[10px] transition-all',
                    business.status === s ? 'bg-accent-emerald/15 text-accent-emerald' : 'text-white/70 hover:bg-surface-3'
                  )}
                >
                  <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', STATUS_DOT_COLORS[s])} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Discover Panel — search for new businesses
// ============================================================

function DiscoverPanel() {
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('Charlotte NC')
  const [source, setSource] = useState<'all' | 'google' | 'yelp' | 'chamber'>('all')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { fetchBusinesses } = useOutreachStore()

  const filteredCategories = useMemo(() => {
    if (!category.trim()) return CATEGORIES
    return CATEGORIES.filter(c => c.toLowerCase().includes(category.toLowerCase()))
  }, [category])

  const handleSearch = async () => {
    if (!category.trim()) return
    setSearching(true)
    setResults([])
    setSelectedIds(new Set())
    try {
      const query = `${category} ${location}`.trim()
      const res = await window.electronAPI.searchBusinesses(query, location)
      setResults(res || [])
    } finally {
      setSearching(false)
    }
  }

  const toggleSelect = (idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleImport = async () => {
    const selected = results.filter((_, i) => selectedIds.has(i))
    if (selected.length === 0) return
    await window.electronAPI.importBusinesses(selected)
    setSelectedIds(new Set())
    setResults([])
    await fetchBusinesses()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="p-4 rounded-xl bg-surface-1/50 border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-medium text-white">Discover New Businesses</h3>

        {/* Category */}
        <div className="relative">
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Category</label>
          <input
            type="text"
            value={category}
            onChange={e => { setCategory(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="e.g. Marketing, Real Estate, Law..."
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
          />
          {showSuggestions && filteredCategories.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-white/[0.06] rounded-lg p-1 z-20 max-h-48 overflow-auto">
              {filteredCategories.map(cat => (
                <button
                  key={cat}
                  onMouseDown={() => { setCategory(cat); setShowSuggestions(false) }}
                  className="w-full text-left px-2 py-1.5 rounded text-[11px] text-white/70 hover:bg-surface-3 transition-all"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="City, State"
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
          />
        </div>

        {/* Source toggle */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Source</label>
          <div className="flex gap-1.5">
            {(['all', 'google', 'yelp', 'chamber'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all capitalize',
                  source === s
                    ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/20'
                    : 'bg-surface-2 text-muted hover:text-white border border-white/[0.06]'
                )}
              >
                {s === 'all' ? 'All Sources' : s === 'google' ? 'Google Places' : s === 'chamber' ? 'Chamber' : 'Yelp'}
              </button>
            ))}
          </div>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={!category.trim() || searching}
          className="px-4 py-2 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium border border-accent-emerald/20 hover:bg-accent-emerald/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {searching && (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-1/50 border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-white">{results.length} Results</h4>
            {selectedIds.size > 0 && (
              <button
                onClick={handleImport}
                className="px-3 py-1.5 rounded-lg bg-accent-emerald/20 hover:bg-accent-emerald/30 text-[10px] font-medium text-accent-emerald transition-all"
              >
                Import {selectedIds.size} Selected
              </button>
            )}
          </div>

          <div className="space-y-0.5 max-h-96 overflow-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-2/60 transition-all"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(i)}
                  onChange={() => toggleSelect(i)}
                  className="w-3 h-3 rounded accent-accent-emerald"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-white/80 truncate">{r.name}</div>
                  <div className="text-[9px] text-muted/50 truncate">{r.address || r.website || ''}</div>
                </div>
                {r.category && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted">{r.category}</span>
                )}
                {r.rating && (
                  <span className="text-[9px] text-accent-amber">{r.rating}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Message Composer
// ============================================================

function MessageComposer() {
  const { templates, selectedBusiness, businesses, contacts, fetchContacts, fetchTemplates } = useOutreachStore()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedBusinessId, setSelectedBusinessId] = useState(selectedBusiness?.id || '')
  const [selectedContactId, setSelectedContactId] = useState('')
  const [draftText, setDraftText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    if (selectedBusiness) {
      setSelectedBusinessId(selectedBusiness.id)
      fetchContacts(selectedBusiness.id)
    }
  }, [selectedBusiness, fetchContacts])

  useEffect(() => {
    if (selectedBusinessId && selectedBusinessId !== selectedBusiness?.id) {
      fetchContacts(selectedBusinessId)
    }
  }, [selectedBusinessId, selectedBusiness?.id, fetchContacts])

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  const handleGenerate = async () => {
    if (!selectedTemplateId || !selectedBusinessId) return
    setGenerating(true)
    try {
      const text = await window.electronAPI.generateMessage(selectedTemplateId, selectedBusinessId, {
        contactId: selectedContactId || undefined,
      })
      setDraftText(text)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!draftText) return
    window.electronAPI.writeClipboard(draftText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="p-4 rounded-xl bg-surface-1/50 border border-white/[0.06] space-y-3">
        <h3 className="text-sm font-medium text-white">Compose Outreach Message</h3>

        {/* Template selector */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Template</label>
          <select
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-blue/30"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.channel})</option>
            ))}
          </select>
        </div>

        {/* Channel indicator */}
        {selectedTemplate && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted">Channel:</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue capitalize">
              {selectedTemplate.channel}
            </span>
          </div>
        )}

        {/* Business selector */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Business</label>
          <select
            value={selectedBusinessId}
            onChange={e => setSelectedBusinessId(e.target.value)}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-blue/30"
          >
            <option value="">Select a business...</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Contact selector */}
        {contacts.length > 0 && (
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Contact (optional)</label>
            <select
              value={selectedContactId}
              onChange={e => setSelectedContactId(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-blue/30"
            >
              <option value="">No specific contact</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!selectedTemplateId || !selectedBusinessId || generating}
          className="px-4 py-2 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium border border-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {generating && (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {generating ? 'Generating...' : 'Generate Message'}
        </button>
      </div>

      {/* Draft area */}
      {(draftText || generating) && (
        <div className="p-4 rounded-xl bg-surface-1/50 border border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-white">Draft</h4>
            <button
              onClick={handleCopy}
              disabled={!draftText}
              className="px-2.5 py-1.5 rounded-lg bg-accent-emerald/20 hover:bg-accent-emerald/30 text-[10px] font-medium text-accent-emerald transition-all disabled:opacity-40"
            >
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>

          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            rows={10}
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-muted/50 focus:outline-none focus:border-accent-blue/30 resize-none leading-relaxed"
            placeholder={generating ? 'Generating...' : 'Your drafted message will appear here...'}
          />

          {/* Channel tip */}
          {selectedTemplate && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-surface-2/50">
              <svg className="w-3.5 h-3.5 text-accent-amber mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-[10px] text-muted">
                {selectedTemplate.channel === 'linkedin' && 'Paste this into a LinkedIn connection request or InMail.'}
                {selectedTemplate.channel === 'email' && 'Copy and paste into your email client.'}
                {selectedTemplate.channel === 'instagram' && 'Paste this into an Instagram DM.'}
                {selectedTemplate.channel === 'facebook' && 'Paste this into a Facebook message.'}
                {selectedTemplate.channel === 'twitter' && 'Paste this into a Twitter/X DM.'}
                {selectedTemplate.channel === 'website' && 'Paste this into the contact form on their website.'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Pipeline Dashboard
// ============================================================

function PipelineDashboard() {
  const { pipelineStats, fetchPipelineStats, businesses, setFilter, setView } = useOutreachStore()

  useEffect(() => {
    fetchPipelineStats()
  }, [fetchPipelineStats])

  const statusConfig: { status: OutreachBusinessStatus; color: string; bgColor: string; borderColor: string }[] = [
    { status: 'New', color: 'text-accent-blue', bgColor: 'bg-accent-blue/10', borderColor: 'border-accent-blue/20' },
    { status: 'Contacted', color: 'text-accent-amber', bgColor: 'bg-accent-amber/10', borderColor: 'border-accent-amber/20' },
    { status: 'Responded', color: 'text-accent-emerald', bgColor: 'bg-accent-emerald/10', borderColor: 'border-accent-emerald/20' },
    { status: 'Not Interested', color: 'text-white/40', bgColor: 'bg-white/5', borderColor: 'border-white/10' },
    { status: 'Meeting Scheduled', color: 'text-accent-purple', bgColor: 'bg-accent-purple/10', borderColor: 'border-accent-purple/20' },
  ]

  const statsMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of pipelineStats) map[s.status] = s.count
    return map
  }, [pipelineStats])

  const totalBusinesses = businesses.length
  const totalContacted = (statsMap['Contacted'] || 0) + (statsMap['Responded'] || 0) + (statsMap['Meeting Scheduled'] || 0)
  const responseRate = totalContacted > 0
    ? (((statsMap['Responded'] || 0) + (statsMap['Meeting Scheduled'] || 0)) / totalContacted * 100).toFixed(1)
    : '0.0'
  const meetingsBooked = statsMap['Meeting Scheduled'] || 0
  const totalInPipeline = pipelineStats.reduce((sum, s) => sum + s.count, 0) || totalBusinesses

  const handleCardClick = (status: OutreachBusinessStatus) => {
    setFilter('status', status)
    setView('businesses')
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Status cards row */}
      <div className="grid grid-cols-5 gap-3">
        {statusConfig.map(({ status, color, bgColor, borderColor }) => {
          const count = statsMap[status] || 0
          return (
            <button
              key={status}
              onClick={() => handleCardClick(status)}
              className={cn(
                'p-3 rounded-xl border transition-all hover:scale-[1.02]',
                bgColor, borderColor
              )}
            >
              <div className={cn('text-2xl font-bold', color)}>{count}</div>
              <div className="text-[10px] text-muted mt-1">{status}</div>
            </button>
          )
        })}
      </div>

      {/* Stats row */}
      <div className="p-4 rounded-xl bg-surface-1/50 border border-white/[0.06]">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{totalBusinesses}</div>
            <div className="text-[10px] text-muted">Total Businesses</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{totalContacted}</div>
            <div className="text-[10px] text-muted">Total Contacted</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-accent-emerald">{responseRate}%</div>
            <div className="text-[10px] text-muted">Response Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-accent-purple">{meetingsBooked}</div>
            <div className="text-[10px] text-muted">Meetings Booked</div>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="p-4 rounded-xl bg-surface-1/50 border border-white/[0.06]">
        <h4 className="text-xs font-medium text-white mb-3">Status Distribution</h4>
        <div className="space-y-2">
          {statusConfig.map(({ status, color, bgColor }) => {
            const count = statsMap[status] || 0
            const pct = totalInPipeline > 0 ? (count / totalInPipeline * 100) : 0
            return (
              <div key={status} className="flex items-center gap-3">
                <span className="text-[10px] text-muted w-28 text-right flex-shrink-0">{status}</span>
                <div className="flex-1 h-4 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', bgColor.replace('/10', '/40'))}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-mono w-10 text-right flex-shrink-0', color)}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
