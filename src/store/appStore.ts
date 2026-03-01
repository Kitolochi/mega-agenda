import { create } from 'zustand'
import { Category } from '../types'

type Tab = 'dashboard' | 'tasks' | 'list' | 'notes' | 'feed' | 'social' | 'chat' | 'code' | 'ai-tasks' | 'memory' | 'memories' | 'roadmap' | 'lab' | 'settings' | 'accounts'

interface AppState {
  activeTab: Tab
  expandedGroup: string | null
  selectedCategory: Category | null
  showAddModal: boolean
  defaultCategoryId: number | undefined
  showVoiceChat: boolean
  showWelcome: boolean

  setActiveTab: (tab: Tab) => void
  setExpandedGroup: (group: string | null) => void
  setSelectedCategory: (cat: Category | null) => void
  setShowAddModal: (show: boolean) => void
  setDefaultCategoryId: (id: number | undefined) => void
  setShowVoiceChat: (show: boolean) => void
  toggleVoiceChat: () => void
  setShowWelcome: (show: boolean) => void

  navigateToTab: (tab: Tab) => void
  openAddFromCategory: (categoryId: number) => void
  closeAddModal: () => void
}

export type { Tab }

export const TAB_GROUPS: { id: string; label: string; tabs: { id: Tab; label: string; shortcut?: string }[] }[] = [
  {
    id: 'daily', label: 'Daily',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', shortcut: 'd' },
      { id: 'tasks', label: 'Tasks', shortcut: 't' },
      { id: 'list', label: 'List', shortcut: 'l' },
      { id: 'notes', label: 'Journal', shortcut: 'j' },
      { id: 'accounts', label: 'Accounts', shortcut: 'b' },
    ]
  },
  {
    id: 'social', label: 'Social',
    tabs: [
      { id: 'feed', label: 'Feed', shortcut: 'f' },
      { id: 'social', label: 'Social', shortcut: 'm' },
      { id: 'chat', label: 'Chat', shortcut: 'h' },
    ]
  },
  {
    id: 'aidev', label: 'AI & Dev',
    tabs: [
      { id: 'code', label: 'Code', shortcut: 'c' },
      { id: 'memory', label: 'Context', shortcut: 'y' },
      { id: 'memories', label: 'Memories' },
      { id: 'roadmap', label: 'Roadmap', shortcut: 'r' },
      { id: 'ai-tasks', label: 'AI', shortcut: 'a' },
      { id: 'lab', label: 'Lab' },
    ]
  },
  {
    id: 'settings', label: '',
    tabs: [
      { id: 'settings', label: 'Settings', shortcut: 's' },
    ]
  },
]

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  expandedGroup: 'daily',
  selectedCategory: null,
  showAddModal: false,
  defaultCategoryId: undefined,
  showVoiceChat: false,
  showWelcome: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setExpandedGroup: (group) => set({ expandedGroup: group }),
  setSelectedCategory: (cat) => set({ selectedCategory: cat }),
  setShowAddModal: (show) => set({ showAddModal: show }),
  setDefaultCategoryId: (id) => set({ defaultCategoryId: id }),
  setShowVoiceChat: (show) => set({ showVoiceChat: show }),
  toggleVoiceChat: () => set((s) => ({ showVoiceChat: !s.showVoiceChat })),
  setShowWelcome: (show) => set({ showWelcome: show }),

  navigateToTab: (tab) => set({ activeTab: tab, selectedCategory: null }),
  openAddFromCategory: (categoryId) => set({ showAddModal: true, defaultCategoryId: categoryId }),
  closeAddModal: () => set({ showAddModal: false, defaultCategoryId: undefined }),
}))
