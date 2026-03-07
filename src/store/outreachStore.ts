import { create } from 'zustand'
import type {
  OutreachBusiness,
  OutreachContact,
  OutreachMessage,
  OutreachTemplate,
  OutreachPipelineStats,
  OutreachBusinessStatus,
} from '../types'

type OutreachView = 'businesses' | 'discover' | 'messages' | 'pipeline'

interface OutreachFilters {
  status: OutreachBusinessStatus | ''
  category: string
  search: string
}

interface GwsStatus {
  installed: boolean
  authenticated: boolean
  checked: boolean
  error?: string
}

interface OutreachState {
  businesses: OutreachBusiness[]
  selectedBusiness: OutreachBusiness | null
  contacts: OutreachContact[]
  templates: OutreachTemplate[]
  outreachHistory: OutreachMessage[]
  pipelineStats: OutreachPipelineStats[]
  currentView: OutreachView
  filters: OutreachFilters
  loading: boolean
  loadingContacts: boolean
  loadingHistory: boolean
  gwsStatus: GwsStatus

  setView: (view: OutreachView) => void
  setFilter: (key: keyof OutreachFilters, value: string) => void
  setSelectedBusiness: (business: OutreachBusiness | null) => void
  fetchBusinesses: () => Promise<void>
  fetchContacts: (businessId: string) => Promise<void>
  fetchTemplates: () => Promise<void>
  fetchPipelineStats: () => Promise<void>
  fetchOutreachHistory: (businessId: string) => Promise<void>
  checkGwsAuth: () => Promise<void>
}

export const useOutreachStore = create<OutreachState>((set, get) => ({
  businesses: [],
  selectedBusiness: null,
  contacts: [],
  templates: [],
  outreachHistory: [],
  pipelineStats: [],
  currentView: 'businesses',
  filters: { status: '', category: '', search: '' },
  loading: false,
  loadingContacts: false,
  loadingHistory: false,
  gwsStatus: { installed: false, authenticated: false, checked: false },

  setView: (view) => set({ currentView: view }),

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  setSelectedBusiness: (business) => {
    set({ selectedBusiness: business, contacts: [], outreachHistory: [] })
    if (business) {
      get().fetchContacts(business.id)
      get().fetchOutreachHistory(business.id)
    }
  },

  fetchBusinesses: async () => {
    set({ loading: true })
    try {
      const businesses = await window.electronAPI.getBusinesses()
      set({ businesses })
    } finally {
      set({ loading: false })
    }
  },

  fetchContacts: async (businessId) => {
    set({ loadingContacts: true })
    try {
      const contacts = await window.electronAPI.getBusinessContacts(businessId)
      set({ contacts })
    } finally {
      set({ loadingContacts: false })
    }
  },

  fetchTemplates: async () => {
    const templates = await window.electronAPI.getTemplates()
    set({ templates })
  },

  fetchPipelineStats: async () => {
    const stats = await window.electronAPI.getOutreachPipelineStats()
    set({ pipelineStats: stats })
  },

  fetchOutreachHistory: async (businessId) => {
    set({ loadingHistory: true })
    try {
      const history = await window.electronAPI.getOutreachHistory(businessId)
      set({ outreachHistory: history })
    } finally {
      set({ loadingHistory: false })
    }
  },

  checkGwsAuth: async () => {
    try {
      const result = await window.electronAPI.gwsCheckAuth()
      set({
        gwsStatus: {
          installed: result.installed,
          authenticated: result.authenticated,
          checked: true,
          error: result.error,
        },
      })
    } catch {
      set({ gwsStatus: { installed: false, authenticated: false, checked: true } })
    }
  },
}))
