import { useState, useEffect, useCallback, useRef } from 'react'
import { Task, Category, Stats, VoiceCommand } from './types'
import Dashboard from './components/Dashboard'
import AddTaskModal from './components/AddTaskModal'
import CategoryView from './components/CategoryView'
import DailyNotes from './components/DailyNotes'
import AllTasks from './components/AllTasks'
import TaskList from './components/TaskList'
import Feed from './components/Feed'
import Settings from './components/Settings'
import VoiceButton from './components/VoiceButton'
import SocialTab from './components/SocialTab'
import PomodoroTimer from './components/PomodoroTimer'
import CodeTerminal from './components/CodeTerminal'
import ChatTab from './components/ChatTab'

type Tab = 'dashboard' | 'tasks' | 'list' | 'notes' | 'feed' | 'social' | 'chat' | 'code' | 'settings'

function App() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | undefined>()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const voiceListeningRef = useRef(false)

  const loadData = useCallback(async () => {
    const [cats, allTasks, statsData] = await Promise.all([
      window.electronAPI.getCategories(),
      window.electronAPI.getTasks(),
      window.electronAPI.getStats()
    ])
    setCategories(cats)
    setTasks(allTasks)
    setStats(statsData)
  }, [])

  useEffect(() => {
    loadData()

    const cleanup = window.electronAPI.onOpenAddModal(() => {
      setShowAddModal(true)
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }
      // Don't intercept any keys when the Code terminal tab is active — all keystrokes go to the terminal
      if (activeTab === 'code') {
        return
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) setShowAddModal(true)
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey) { setActiveTab('dashboard'); setSelectedCategory(null) }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) { setActiveTab('tasks'); setSelectedCategory(null) }
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) { setActiveTab('list'); setSelectedCategory(null) }
      if (e.key === 'j' && !e.metaKey && !e.ctrlKey) { setActiveTab('notes'); setSelectedCategory(null) }
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) { setActiveTab('feed'); setSelectedCategory(null) }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey) { setActiveTab('social'); setSelectedCategory(null) }
      if (e.key === 'h' && !e.metaKey && !e.ctrlKey) { setActiveTab('chat'); setSelectedCategory(null) }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) { setActiveTab('code'); setSelectedCategory(null) }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) { setActiveTab('settings'); setSelectedCategory(null) }
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey) { (window as any).__voiceToggle?.() }
      if (e.key === 'p' && !e.metaKey && !e.ctrlKey) { (window as any).__pomodoroToggle?.() }
      if (e.key === 'Escape') {
        if (showAddModal) setShowAddModal(false)
        else if (selectedCategory) setSelectedCategory(null)
      }
      if (/^[1-7]$/.test(e.key) && activeTab === 'dashboard' && !selectedCategory) {
        const catIndex = parseInt(e.key) - 1
        if (categories[catIndex]) setSelectedCategory(categories[catIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { cleanup(); window.removeEventListener('keydown', handleKeyDown) }
  }, [loadData, showAddModal, selectedCategory, activeTab, categories])

  const handleAddTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    await window.electronAPI.addTask(task)
    await loadData()
    setShowAddModal(false)
    setDefaultCategoryId(undefined)
  }

  const handleToggleTask = async (id: number) => {
    await window.electronAPI.toggleTask(id)
    await loadData()
  }

  const handleDeleteTask = async (id: number) => {
    await window.electronAPI.deleteTask(id)
    await loadData()
  }

  const handleOpenAddFromCategory = (categoryId: number) => {
    setDefaultCategoryId(categoryId)
    setShowAddModal(true)
  }

  const handleVoiceCommand = useCallback(async (command: VoiceCommand) => {
    switch (command.action) {
      case 'switch_tab': {
        const tabMap: Record<string, Tab> = { dashboard: 'dashboard', tasks: 'tasks', list: 'list', notes: 'notes', feed: 'feed', social: 'social', chat: 'chat', code: 'code', settings: 'settings' }
        const tab = tabMap[command.tab || '']
        if (tab) { setActiveTab(tab); setSelectedCategory(null) }
        break
      }
      case 'add_task': {
        const cat = categories.find(c =>
          c.name.toLowerCase() === (command.category || '').toLowerCase()
        ) || categories[0]
        if (command.title && cat) {
          await window.electronAPI.addTask({
            category_id: cat.id,
            title: command.title,
            description: command.description || undefined,
            priority: command.priority || 2,
            completed: 0,
            is_recurring: false,
          })
          await loadData()
        }
        break
      }
      case 'open_modal':
        setShowAddModal(true)
        break
      case 'complete_task': {
        if (command.title) {
          const needle = command.title.toLowerCase()
          const match = tasks.find(t =>
            !t.completed && t.title.toLowerCase().includes(needle)
          )
          if (match) {
            await window.electronAPI.toggleTask(match.id)
            await loadData()
          }
        }
        break
      }
      case 'add_note':
        setActiveTab('notes')
        setSelectedCategory(null)
        break
      case 'summarize_feed':
        setActiveTab('feed')
        setSelectedCategory(null)
        break
    }
  }, [categories, tasks, loadData])

  return (
    <div className="h-screen bg-surface-0 text-white flex flex-col font-body noise-bg relative">
      {/* Title Bar */}
      <div className="drag-region bg-surface-1/80 backdrop-blur-md px-4 py-2.5 flex items-center justify-between border-b border-white/[0.04] relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">M</span>
          </div>
          <h1 className="text-xs font-display font-semibold text-white/80 tracking-wide uppercase">Mega Agenda</h1>
        </div>
        <div className="flex gap-1.5 no-drag items-center">
          <PomodoroTimer tasks={tasks} />
          <button
            onClick={() => { setActiveTab('social'); setSelectedCategory(null) }}
            className="w-6 h-6 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-accent-blue transition-all"
            title="Social Media Manager"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>
          <VoiceButton
            categories={categories}
            onCommand={handleVoiceCommand}
            listeningRef={voiceListeningRef}
          />
          <button
            onClick={() => window.electronAPI.minimizeWindow()}
            className="w-6 h-6 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 10 1"><rect width="10" height="1" /></svg>
          </button>
          <button
            onClick={() => window.electronAPI.closeWindow()}
            className="w-6 h-6 rounded-md hover:bg-accent-red/20 flex items-center justify-center text-white/30 hover:text-accent-red transition-all"
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex px-4 pt-1 pb-0 bg-surface-1/40 border-b border-white/[0.03] relative z-10">
        {[
          { id: 'dashboard' as Tab, label: 'Dashboard', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          )},
          { id: 'tasks' as Tab, label: 'Tasks', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          )},
          { id: 'list' as Tab, label: 'List', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )},
          { id: 'notes' as Tab, label: 'Journal', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )},
          { id: 'feed' as Tab, label: 'Feed', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          )},
          { id: 'social' as Tab, label: 'Social', icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          )},
          { id: 'chat' as Tab, label: 'Chat', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )},
          { id: 'code' as Tab, label: 'Code', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )},
          { id: 'settings' as Tab, label: '', icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedCategory(null) }}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all relative ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-muted hover:text-white/70'
            }`}
          >
            {tab.icon}
            {tab.label && <span>{tab.label}</span>}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent-blue rounded-full" />
            )}
          </button>
        ))}

        {/* Keyboard shortcuts hint */}
        <div className="ml-auto flex items-center">
          <div className="flex gap-1 items-center opacity-0 hover:opacity-100 transition-opacity duration-300">
            {[{ key: 'N', label: 'add' }, { key: 'D', label: 'dash' }, { key: 'T', label: 'tasks' }, { key: 'L', label: 'list' }, { key: 'J', label: 'journal' }, { key: 'F', label: 'feed' }, { key: 'M', label: 'social' }, { key: 'H', label: 'chat' }, { key: 'C', label: 'code' }, { key: 'S', label: 'settings' }, { key: 'V', label: 'voice' }, { key: 'P', label: 'focus' }].map(s => (
              <span key={s.key} className="text-[9px] text-muted">
                <kbd className="px-1 py-0.5 rounded bg-surface-3 text-white/40 font-mono text-[8px] mr-0.5">{s.key}</kbd>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 relative z-10 ${activeTab === 'code' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {/* CodeTerminal always mounted — hidden via CSS when not active */}
        <CodeTerminal active={activeTab === 'code'} />
        {activeTab === 'code' ? null : activeTab === 'social' ? (
          <SocialTab />
        ) : activeTab === 'chat' ? (
          <ChatTab />
        ) : activeTab === 'settings' ? (
          <Settings />
        ) : activeTab === 'feed' ? (
          <Feed onOpenSettings={() => setActiveTab('settings')} />
        ) : activeTab === 'list' ? (
          <TaskList tasks={tasks} categories={categories} onToggleTask={handleToggleTask} />
        ) : activeTab === 'tasks' ? (
          <AllTasks tasks={tasks} categories={categories} onToggleTask={handleToggleTask} />
        ) : activeTab === 'notes' ? (
          <DailyNotes />
        ) : selectedCategory ? (
          <CategoryView
            category={selectedCategory}
            tasks={tasks.filter(t => t.category_id === selectedCategory.id)}
            onBack={() => setSelectedCategory(null)}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onAddTask={() => handleOpenAddFromCategory(selectedCategory.id)}
          />
        ) : (
          <Dashboard
            categories={categories}
            tasks={tasks}
            stats={stats}
            onCategoryClick={setSelectedCategory}
            onToggleTask={handleToggleTask}
            onAddTask={handleOpenAddFromCategory}
          />
        )}
      </div>

      {/* FAB */}
      {activeTab === 'dashboard' && !selectedCategory && (
        <button
          onClick={() => setShowAddModal(true)}
          className="absolute bottom-5 right-5 z-20 w-11 h-11 bg-gradient-to-br from-accent-blue to-accent-purple rounded-xl shadow-lg shadow-accent-blue/20 flex items-center justify-center text-white hover:shadow-accent-blue/40 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <AddTaskModal
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          onAdd={handleAddTask}
          onClose={() => { setShowAddModal(false); setDefaultCategoryId(undefined) }}
        />
      )}

    </div>
  )
}

export default App
