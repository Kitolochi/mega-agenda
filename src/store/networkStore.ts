import { create } from 'zustand'
import { NetworkContact, ContactInteraction, Pipeline, PipelineCard, SocialConnection, SocialProvider } from '../types'

export type NetworkView = 'contacts' | 'contact-detail' | 'pipeline' | 'connections'

interface NetworkState {
  contacts: NetworkContact[]
  interactions: ContactInteraction[]
  pipelines: Pipeline[]
  pipelineCards: PipelineCard[]
  socialConnections: SocialConnection[]
  syncingProviders: Set<SocialProvider>
  loading: boolean
  view: NetworkView
  selectedContactId: string | null
  selectedPipelineId: string | null
  searchQuery: string
  tagFilter: string | null

  loadData: () => Promise<void>
  loadSocialConnections: () => Promise<void>
  connectProvider: (provider: SocialProvider, credentials: any) => Promise<SocialConnection>
  disconnectProvider: (connectionId: string) => Promise<void>
  syncProvider: (connectionId: string) => Promise<{ newContacts: number; newInteractions: number }>
  deleteConnection: (connectionId: string) => Promise<void>
  setView: (view: NetworkView) => void
  selectContact: (id: string | null) => void
  selectPipeline: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setTagFilter: (tag: string | null) => void

  // Contact actions
  createContact: (data: Omit<NetworkContact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<NetworkContact>
  updateContact: (id: string, updates: Partial<NetworkContact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>

  // Interaction actions
  createInteraction: (data: Omit<ContactInteraction, 'id' | 'createdAt'>) => Promise<void>
  deleteInteraction: (id: string) => Promise<void>

  // Pipeline actions
  createPipeline: (data: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Pipeline>
  updatePipeline: (id: string, updates: Partial<Pipeline>) => Promise<void>
  deletePipeline: (id: string) => Promise<void>
  ensureDefaultPipeline: () => Promise<void>

  // Pipeline card actions
  createPipelineCard: (data: Omit<PipelineCard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updatePipelineCard: (id: string, updates: Partial<PipelineCard>) => Promise<void>
  movePipelineCard: (id: string, stage: string) => Promise<void>
  deletePipelineCard: (id: string) => Promise<void>
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  contacts: [],
  interactions: [],
  pipelines: [],
  pipelineCards: [],
  socialConnections: [],
  syncingProviders: new Set(),
  loading: false,
  view: 'contacts',
  selectedContactId: null,
  selectedPipelineId: null,
  searchQuery: '',
  tagFilter: null,

  loadData: async () => {
    set({ loading: true })
    try {
      const [contacts, interactions, pipelines, pipelineCards, socialConnections] = await Promise.all([
        window.electronAPI.getNetworkContacts(),
        window.electronAPI.getContactInteractions(),
        window.electronAPI.getPipelines(),
        window.electronAPI.getPipelineCards(),
        window.electronAPI.getSocialConnections(),
      ])
      set({ contacts, interactions, pipelines, pipelineCards, socialConnections, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  loadSocialConnections: async () => {
    try {
      const socialConnections = await window.electronAPI.getSocialConnections()
      set({ socialConnections })
    } catch {
      // ignore
    }
  },

  connectProvider: async (provider, credentials) => {
    const conn = await window.electronAPI.connectSocialProvider(provider, credentials)
    await get().loadSocialConnections()
    return conn
  },

  disconnectProvider: async (connectionId) => {
    await window.electronAPI.disconnectSocialProvider(connectionId)
    await get().loadSocialConnections()
  },

  syncProvider: async (connectionId) => {
    const conn = get().socialConnections.find(c => c.id === connectionId)
    if (conn) {
      set(s => ({ syncingProviders: new Set([...s.syncingProviders, conn.provider]) }))
    }
    try {
      const result = await window.electronAPI.syncSocialProvider(connectionId)
      await get().loadData() // Reload everything — new contacts/interactions may have been created
      return result
    } finally {
      if (conn) {
        set(s => {
          const next = new Set(s.syncingProviders)
          next.delete(conn.provider)
          return { syncingProviders: next }
        })
      }
    }
  },

  deleteConnection: async (connectionId) => {
    await window.electronAPI.deleteSocialConnection(connectionId)
    await get().loadSocialConnections()
  },

  setView: (view) => set({ view }),
  selectContact: (id) => set({ selectedContactId: id, view: id ? 'contact-detail' : 'contacts' }),
  selectPipeline: (id) => set({ selectedPipelineId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setTagFilter: (tag) => set((s) => ({ tagFilter: s.tagFilter === tag ? null : tag })),

  createContact: async (data) => {
    const contact = await window.electronAPI.createNetworkContact(data)
    await get().loadData()
    return contact
  },
  updateContact: async (id, updates) => {
    await window.electronAPI.updateNetworkContact(id, updates)
    await get().loadData()
  },
  deleteContact: async (id) => {
    await window.electronAPI.deleteNetworkContact(id)
    const state = get()
    if (state.selectedContactId === id) {
      set({ selectedContactId: null, view: 'contacts' })
    }
    await get().loadData()
  },

  createInteraction: async (data) => {
    await window.electronAPI.createContactInteraction(data)
    await get().loadData()
  },
  deleteInteraction: async (id) => {
    await window.electronAPI.deleteContactInteraction(id)
    await get().loadData()
  },

  createPipeline: async (data) => {
    const pipeline = await window.electronAPI.createPipeline(data)
    await get().loadData()
    return pipeline
  },
  updatePipeline: async (id, updates) => {
    await window.electronAPI.updatePipeline(id, updates)
    await get().loadData()
  },
  deletePipeline: async (id) => {
    await window.electronAPI.deletePipeline(id)
    const state = get()
    if (state.selectedPipelineId === id) {
      set({ selectedPipelineId: null })
    }
    await get().loadData()
  },
  ensureDefaultPipeline: async () => {
    const state = get()
    if (state.pipelines.length === 0) {
      const pipeline = await window.electronAPI.createPipeline({
        name: 'Outreach',
        stages: ['Lead', 'Contacted', 'Responded', 'Meeting', 'Closed'],
      })
      await get().loadData()
      set({ selectedPipelineId: pipeline.id })
    } else if (!state.selectedPipelineId) {
      set({ selectedPipelineId: state.pipelines[0].id })
    }
  },

  createPipelineCard: async (data) => {
    await window.electronAPI.createPipelineCard(data)
    await get().loadData()
  },
  updatePipelineCard: async (id, updates) => {
    await window.electronAPI.updatePipelineCard(id, updates)
    await get().loadData()
  },
  movePipelineCard: async (id, stage) => {
    await window.electronAPI.movePipelineCard(id, stage)
    await get().loadData()
  },
  deletePipelineCard: async (id) => {
    await window.electronAPI.deletePipelineCard(id)
    await get().loadData()
  },
}))
