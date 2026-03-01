import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '../store'
import { useTaskStore } from '../store'
import type { Tab } from '../store'

export interface CommandItem {
  id: string
  type: 'tab' | 'task' | 'action'
  title: string
  subtitle?: string
  icon?: string
  action: () => void
}

function fuzzyMatch(query: string, text: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

const TAB_COMMANDS: { id: Tab; label: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Daily' },
  { id: 'tasks', label: 'Tasks', group: 'Daily' },
  { id: 'list', label: 'Task List', group: 'Daily' },
  { id: 'notes', label: 'Journal', group: 'Daily' },
  { id: 'feed', label: 'Feed', group: 'Social' },
  { id: 'social', label: 'Social / Twitter', group: 'Social' },
  { id: 'chat', label: 'Chat', group: 'Social' },
  { id: 'code', label: 'Code Terminal', group: 'AI & Dev' },
  { id: 'memory', label: 'Context Files', group: 'AI & Dev' },
  { id: 'memories', label: 'Memories', group: 'AI & Dev' },
  { id: 'roadmap', label: 'Roadmap', group: 'AI & Dev' },
  { id: 'ai-tasks', label: 'AI Tasks', group: 'AI & Dev' },
  { id: 'settings', label: 'Settings', group: 'Settings' },
]

export function useCommandPalette() {
  const [query, setQuery] = useState('')

  const items = useMemo((): CommandItem[] => {
    const results: CommandItem[] = []

    // Tab navigation commands
    for (const tab of TAB_COMMANDS) {
      results.push({
        id: `tab-${tab.id}`,
        type: 'tab',
        title: tab.label,
        subtitle: tab.group,
        action: () => useAppStore.getState().navigateToTab(tab.id),
      })
    }

    // Tasks
    const tasks = useTaskStore.getState().tasks
    for (const task of tasks.filter(t => !t.completed).slice(0, 20)) {
      results.push({
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        subtitle: task.description || undefined,
        action: () => {
          useAppStore.getState().navigateToTab('tasks')
        },
      })
    }

    // Actions
    results.push({
      id: 'action-add-task',
      type: 'action',
      title: 'Add New Task',
      subtitle: 'Create a new task',
      action: () => useAppStore.getState().setShowAddModal(true),
    })
    results.push({
      id: 'action-voice-chat',
      type: 'action',
      title: 'Toggle Voice Chat',
      subtitle: 'Open/close voice conversation',
      action: () => useAppStore.getState().toggleVoiceChat(),
    })

    return results
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 15)
    return items.filter(item =>
      fuzzyMatch(query, item.title) || (item.subtitle && fuzzyMatch(query, item.subtitle))
    ).slice(0, 15)
  }, [query, items])

  const reset = useCallback(() => setQuery(''), [])

  return { query, setQuery, items: filtered, reset }
}
