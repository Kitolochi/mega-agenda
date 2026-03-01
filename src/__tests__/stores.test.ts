import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store/appStore'

describe('appStore', () => {
  beforeEach(() => {
    // Reset store to defaults
    useAppStore.setState({
      activeTab: 'dashboard',
      expandedGroup: 'daily',
      selectedCategory: null,
      showAddModal: false,
      defaultCategoryId: undefined,
      showVoiceChat: false,
      showWelcome: false,
    })
  })

  it('has correct initial state', () => {
    const state = useAppStore.getState()
    expect(state.activeTab).toBe('dashboard')
    expect(state.showAddModal).toBe(false)
    expect(state.showVoiceChat).toBe(false)
  })

  it('navigateToTab sets tab and clears category', () => {
    useAppStore.getState().setSelectedCategory({ id: 1, name: 'Test', color: '#fff', icon: 'x', sort_order: 0 })
    useAppStore.getState().navigateToTab('chat')
    const state = useAppStore.getState()
    expect(state.activeTab).toBe('chat')
    expect(state.selectedCategory).toBeNull()
  })

  it('openAddFromCategory sets modal and categoryId', () => {
    useAppStore.getState().openAddFromCategory(5)
    const state = useAppStore.getState()
    expect(state.showAddModal).toBe(true)
    expect(state.defaultCategoryId).toBe(5)
  })

  it('closeAddModal clears both', () => {
    useAppStore.getState().openAddFromCategory(5)
    useAppStore.getState().closeAddModal()
    const state = useAppStore.getState()
    expect(state.showAddModal).toBe(false)
    expect(state.defaultCategoryId).toBeUndefined()
  })

  it('toggleVoiceChat flips state', () => {
    expect(useAppStore.getState().showVoiceChat).toBe(false)
    useAppStore.getState().toggleVoiceChat()
    expect(useAppStore.getState().showVoiceChat).toBe(true)
    useAppStore.getState().toggleVoiceChat()
    expect(useAppStore.getState().showVoiceChat).toBe(false)
  })
})
