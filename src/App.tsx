import { useEffect } from 'react'
import { useAppStore } from './store'
import { useTaskStore } from './store'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import AppShell from './components/layout/AppShell'

function App() {
  const { setShowAddModal, setShowWelcome } = useAppStore()
  const { loadData } = useTaskStore()

  // Initialize data on mount
  useEffect(() => {
    loadData()
    window.electronAPI.isWelcomeDismissed().then(dismissed => {
      if (!dismissed) setShowWelcome(true)
    }).catch(() => {})

    const cleanup = window.electronAPI.onOpenAddModal(() => {
      setShowAddModal(true)
    })

    const cleanupTasksUpdated = window.electronAPI.onTasksUpdated(() => {
      useTaskStore.getState().loadData()
    })

    return () => { cleanup(); cleanupTasksUpdated() }
  }, [loadData, setShowAddModal, setShowWelcome])

  // Register keyboard shortcuts
  useKeyboardShortcuts()

  return (
    <div className="h-screen bg-surface-0 text-white flex flex-col font-body noise-bg relative isolate">
      <AppShell />
    </div>
  )
}

export default App
