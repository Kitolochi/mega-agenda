import { useCallback } from 'react'
import { useAppStore } from '../../store'
import { useTaskStore } from '../../store'
import ErrorBoundary from '../ui/ErrorBoundary'
import Dashboard from '../Dashboard'
import CategoryView from '../CategoryView'
import DailyNotes from '../DailyNotes'
import AllTasks from '../AllTasks'
import TaskList from '../TaskList'
import Feed from '../Feed'
import Settings from '../Settings'
import SocialTab from '../SocialTab'
import CodeTerminal from '../CodeTerminal'
import ChatTab from '../ChatTab'
import AITasksBoard from '../AITasksBoard'
import MemoryTab from '../MemoryTab'
import MemoriesTab from '../MemoriesTab'
import RoadmapTab from '../RoadmapTab'
import LabTab from '../LabTab'
import AccountsTab from '../bank-sync/AccountsTab'

export default function ContentArea() {
  const { activeTab, selectedCategory, navigateToTab, setSelectedCategory, openAddFromCategory } = useAppStore()
  const { categories, tasks, stats, toggleTask, deleteTask } = useTaskStore()

  const handleTerminalCommand = useCallback((command: string) => {
    useAppStore.getState().navigateToTab('code')
    window.electronAPI.writeTerminal('\x03')
    setTimeout(() => window.electronAPI.writeTerminal(command), 300)
  }, [])

  const renderTab = () => {
    if (activeTab === 'code') return null
    if (activeTab === 'roadmap') return <RoadmapTab />
    if (activeTab === 'memory') return <MemoryTab />
    if (activeTab === 'memories') return <MemoriesTab />
    if (activeTab === 'lab') return <LabTab />
    if (activeTab === 'accounts') return <AccountsTab />
    if (activeTab === 'ai-tasks') return <AITasksBoard onTerminalCommand={handleTerminalCommand} />
    if (activeTab === 'social') return <SocialTab />
    if (activeTab === 'chat') return <ChatTab />
    if (activeTab === 'settings') return <Settings />
    if (activeTab === 'feed') return <Feed onOpenSettings={() => navigateToTab('settings')} />
    if (activeTab === 'list') return <TaskList tasks={tasks} categories={categories} onToggleTask={toggleTask} />
    if (activeTab === 'tasks') return <AllTasks tasks={tasks} categories={categories} onToggleTask={toggleTask} />
    if (activeTab === 'notes') return <DailyNotes />
    if (selectedCategory) {
      return (
        <CategoryView
          category={selectedCategory}
          tasks={tasks.filter(t => t.category_id === selectedCategory.id)}
          onBack={() => setSelectedCategory(null)}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onAddTask={() => openAddFromCategory(selectedCategory.id)}
        />
      )
    }
    return (
      <Dashboard
        categories={categories}
        tasks={tasks}
        stats={stats}
        onCategoryClick={setSelectedCategory}
        onToggleTask={toggleTask}
        onAddTask={openAddFromCategory}
      />
    )
  }

  return (
    <div className={`flex-1 relative z-10 bg-surface-0/50 backdrop-blur-sm ${activeTab === 'code' ? 'overflow-hidden' : 'overflow-auto'}`}>
      <CodeTerminal active={activeTab === 'code'} />
      <ErrorBoundary key={activeTab}>
        <div key={activeTab} className="tab-content-enter">
          {renderTab()}
        </div>
      </ErrorBoundary>
    </div>
  )
}
