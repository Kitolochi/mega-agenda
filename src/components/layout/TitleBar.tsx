import { useAppStore } from '../../store'
import { useTaskStore } from '../../store'
import PomodoroTimer from '../PomodoroTimer'
import VoiceButton from '../VoiceButton'
import { useRef, useCallback } from 'react'
import { VoiceCommand } from '../../types'
import type { Tab } from '../../store'

export default function TitleBar() {
  const { navigateToTab, showVoiceChat, setShowVoiceChat } = useAppStore()
  const { tasks, categories } = useTaskStore()
  const voiceListeningRef = useRef(false)

  const handleVoiceCommand = useCallback(async (command: VoiceCommand) => {
    const { navigateToTab, setShowAddModal } = useAppStore.getState()
    const { categories, tasks, loadData } = useTaskStore.getState()

    switch (command.action) {
      case 'switch_tab': {
        const tabMap: Record<string, Tab> = { dashboard: 'dashboard', tasks: 'tasks', list: 'list', notes: 'notes', feed: 'feed', social: 'social', chat: 'chat', code: 'code', 'ai-tasks': 'ai-tasks', memory: 'memory', memories: 'memories', roadmap: 'roadmap', settings: 'settings' }
        const tab = tabMap[command.tab || '']
        if (tab) navigateToTab(tab)
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
        navigateToTab('notes')
        break
      case 'summarize_feed':
        navigateToTab('feed')
        break
    }
  }, [])

  return (
    <div className="drag-region bg-surface-1/85 backdrop-blur-lg px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06] relative z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center animate-breathe shadow-lg shadow-accent-blue/20">
          <span className="text-[10px] font-bold text-white">M</span>
        </div>
        <h1 className="text-xs font-display font-semibold tracking-wide uppercase">
          <span className="gradient-text">Mega Agenda</span>
        </h1>
      </div>
      <div className="flex gap-1.5 no-drag items-center">
        <PomodoroTimer tasks={tasks} />
        <button
          onClick={() => navigateToTab('social')}
          className="w-6 h-6 rounded-md hover:bg-white/[0.1] flex items-center justify-center text-white/30 hover:text-accent-blue transition-all"
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
          onClick={() => setShowVoiceChat(!showVoiceChat)}
          className={`no-drag w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 ${
            showVoiceChat
              ? 'bg-accent-purple/20 text-accent-purple'
              : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'
          }`}
          title="Voice Chat (Shift+V)"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          className="w-6 h-6 rounded-md hover:bg-white/[0.1] flex items-center justify-center text-white/30 hover:text-white/60 transition-all duration-200 hover:scale-110 active:scale-90"
        >
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 10 1"><rect width="10" height="1" /></svg>
        </button>
        <button
          onClick={() => window.electronAPI.closeWindow()}
          className="w-6 h-6 rounded-md hover:bg-accent-red/20 flex items-center justify-center text-white/30 hover:text-accent-red transition-all duration-200 hover:scale-110 active:scale-90"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
