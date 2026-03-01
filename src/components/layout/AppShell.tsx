import { useEffect } from 'react'
import { useAppStore, TAB_GROUPS } from '../../store'
import TitleBar from './TitleBar'
import TabNavigation from './TabNavigation'
import ContentArea from './ContentArea'
import AddTaskModal from '../AddTaskModal'
import WelcomeModal from '../WelcomeModal'
import VoiceChatOverlay from '../VoiceChatOverlay'
import CommandPalette from '../CommandPalette'
import AnimatedBackground from '../AnimatedBackground'
import { useTaskStore } from '../../store'
import { playModalOpen, playModalClose } from '../../utils/sounds'

export default function AppShell() {
  const {
    activeTab, showAddModal, showVoiceChat, showWelcome,
    selectedCategory, defaultCategoryId,
    setExpandedGroup, setShowAddModal, setShowVoiceChat, setShowWelcome,
    closeAddModal,
  } = useAppStore()
  const { categories, addTask } = useTaskStore()

  // Auto-expand the group containing the active tab
  useEffect(() => {
    const group = TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab))
    if (group && group.tabs.length > 1) {
      setExpandedGroup(group.id)
    } else if (group && group.tabs.length === 1) {
      setExpandedGroup(null)
    }
  }, [activeTab, setExpandedGroup])

  const handleAddTask = async (task: Parameters<typeof addTask>[0]) => {
    await addTask(task)
    closeAddModal()
  }

  return (
    <div className="flex flex-col h-screen relative">
      <AnimatedBackground />
      <TitleBar />
      <TabNavigation />
      <ContentArea />

      {/* FAB */}
      {activeTab === 'dashboard' && !selectedCategory && (
        <button
          onClick={() => { setShowAddModal(true); playModalOpen() }}
          className="absolute bottom-5 right-5 z-20 w-12 h-12 bg-gradient-to-br from-accent-blue to-accent-purple rounded-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-200 animate-fab-pulse group"
        >
          <svg className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal onDismiss={() => {
          setShowWelcome(false)
          window.electronAPI.dismissWelcome()
          playModalClose()
        }} />
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          onAdd={handleAddTask}
          onClose={() => { closeAddModal(); playModalClose() }}
        />
      )}

      {/* Voice Chat Overlay */}
      <VoiceChatOverlay
        isOpen={showVoiceChat}
        onClose={() => setShowVoiceChat(false)}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette />
    </div>
  )
}
