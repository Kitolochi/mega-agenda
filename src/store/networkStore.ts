import { create } from 'zustand'
import { NetworkContact, ContactInteraction, Pipeline, PipelineCard } from '../types'

export type NetworkView = 'contacts' | 'contact-detail' | 'pipeline'

interface NetworkState {
  contacts: NetworkContact[]
  interactions: ContactInteraction[]
  pipelines: Pipeline[]
  pipelineCards: PipelineCard[]
  loading: boolean
  view: NetworkView
  selectedContactId: string | null
  selectedPipelineId: string | null
  searchQuery: string
  tagFilter: string | null

  loadData: () => Promise<void>
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
  loading: false,
  view: 'contacts',
  selectedContactId: null,
  selectedPipelineId: null,
  searchQuery: '',
  tagFilter: null,

  loadData: async () => {
    set({ loading: true })
    try {
      const [contacts, interactions, pipelines, pipelineCards] = await Promise.all([
        window.electronAPI.getNetworkContacts(),
        window.electronAPI.getContactInteractions(),
        window.electronAPI.getPipelines(),
        window.electronAPI.getPipelineCards(),
      ])
      set({ contacts, interactions, pipelines, pipelineCards, loading: false })
    } catch {
      set({ loading: false })
    }
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
