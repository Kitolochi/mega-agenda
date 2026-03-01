import { useEffect } from 'react'
import { useAppStore } from '../store'
import type { Tab } from '../store'
import { useTaskStore } from '../store'

const TAB_SHORTCUTS: Record<string, Tab> = {
  d: 'dashboard',
  t: 'tasks',
  l: 'list',
  j: 'notes',
  f: 'feed',
  m: 'social',
  h: 'chat',
  c: 'code',
  a: 'ai-tasks',
  y: 'memory',
  r: 'roadmap',
  s: 'settings',
}

export function useKeyboardShortcuts() {

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }
      // Don't intercept any keys when the Code terminal tab is active
      if (useAppStore.getState().activeTab === 'code') {
        return
      }

      const { navigateToTab, setShowAddModal, setSelectedCategory } = useAppStore.getState()

      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) setShowAddModal(true)

      // Tab shortcuts
      const tab = TAB_SHORTCUTS[e.key]
      if (tab && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        navigateToTab(tab)
      }

      if (e.key === 'v' && !e.shiftKey && !e.metaKey && !e.ctrlKey) { (window as any).__voiceToggle?.() }
      if (e.key === 'V' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        useAppStore.getState().toggleVoiceChat()
      }
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey) { (window as any).__pomodoroToggle?.() }

      if (e.key === 'Escape') {
        const state = useAppStore.getState()
        if (state.showVoiceChat) state.setShowVoiceChat(false)
        else if (state.showAddModal) state.setShowAddModal(false)
        else if (state.selectedCategory) state.setSelectedCategory(null)
      }

      if (/^[1-7]$/.test(e.key) && useAppStore.getState().activeTab === 'dashboard' && !useAppStore.getState().selectedCategory) {
        const cats = useTaskStore.getState().categories
        const catIndex = parseInt(e.key) - 1
        if (cats[catIndex]) setSelectedCategory(cats[catIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
