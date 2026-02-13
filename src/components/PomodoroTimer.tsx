import { useState, useEffect, useCallback, useRef } from 'react'
import { PomodoroState, Task } from '../types'

interface PomodoroTimerProps {
  tasks: Task[]
}

export default function PomodoroTimer({ tasks }: PomodoroTimerProps) {
  const [state, setState] = useState<PomodoroState | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const loadState = useCallback(async () => {
    const s = await window.electronAPI.getPomodoroState()
    setState(s)
  }, [])

  useEffect(() => { loadState() }, [loadState])

  // Timer countdown using absolute timestamps
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!state?.isRunning || !state.currentSession) {
      setTimeLeft('')
      return
    }

    const tick = () => {
      if (!state.currentSession) return
      const endTime = new Date(state.currentSession.startedAt).getTime() + state.currentSession.durationMinutes * 60 * 1000
      const remaining = Math.max(0, endTime - Date.now())
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)

      if (remaining <= 0) {
        handleSessionEnd()
      }
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state?.isRunning, state?.currentSession?.startedAt])

  const handleSessionEnd = async () => {
    if (!state?.currentSession) return
    const wasWork = state.currentSession.type === 'work'
    const newState = await window.electronAPI.completePomodoro()
    setState(newState)

    if (wasWork) {
      await window.electronAPI.showNotification(
        'Pomodoro Complete!',
        `Great work! Session ${newState.sessionsCompleted} done. Time for a break.`
      )
      // Auto-start break
      const breakType = newState.sessionsCompleted % 4 === 0 ? 'long_break' : 'short_break'
      const breakState = await window.electronAPI.startBreak(breakType)
      setState(breakState)
    } else {
      await window.electronAPI.showNotification(
        'Break Over!',
        'Ready for another focus session?'
      )
    }
  }

  const handleStartPomodoro = async (task: Task | null) => {
    setShowPicker(false)
    setSearch('')
    const s = await window.electronAPI.startPomodoro(
      task?.id || null,
      task?.title || 'Free Focus',
      25
    )
    setState(s)
  }

  const handleStop = async () => {
    const s = await window.electronAPI.stopPomodoro()
    setState(s)
  }

  // Close picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
        setSearch('')
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  // Expose toggle for keyboard shortcut
  useEffect(() => {
    (window as any).__pomodoroToggle = () => {
      if (state?.isRunning) {
        handleStop()
      } else {
        setShowPicker(prev => !prev)
      }
    }
    return () => { delete (window as any).__pomodoroToggle }
  }, [state?.isRunning])

  const pendingTasks = tasks.filter(t => !t.completed)
  const filteredTasks = search
    ? pendingTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : pendingTasks.slice(0, 8)

  const isRunning = state?.isRunning && state?.currentSession
  const isBreak = state?.currentSession?.type === 'short_break' || state?.currentSession?.type === 'long_break'

  return (
    <div className="relative" ref={pickerRef}>
      {isRunning ? (
        <div className="flex items-center gap-1.5">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${isBreak ? 'bg-accent-blue/10' : 'bg-accent-emerald/10'}`}>
            <span className={`text-[10px] font-mono font-bold ${isBreak ? 'text-accent-blue' : 'text-accent-emerald'}`}>
              {timeLeft}
            </span>
            <span className="text-[9px] text-white/40 truncate max-w-[60px]">
              {state.currentSession?.taskTitle}
            </span>
          </div>
          <button
            onClick={handleStop}
            className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-accent-red hover:bg-accent-red/10 transition-all"
            title="Stop timer"
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-6 h-6 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-accent-emerald transition-all"
          title="Start Pomodoro (P)"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M12 7v5l3 3" />
          </svg>
        </button>
      )}

      {/* Task Picker Dropdown */}
      {showPicker && (
        <div className="absolute top-8 right-0 w-64 glass-card rounded-xl shadow-xl border border-white/[0.08] overflow-hidden z-50 animate-slide-up">
          <div className="p-2 border-b border-white/[0.04]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-auto">
            <button
              onClick={() => handleStartPomodoro(null)}
              className="w-full px-3 py-2 text-left text-xs text-accent-blue hover:bg-white/[0.04] transition-all flex items-center gap-2"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Free Focus (no task)
            </button>
            {filteredTasks.map(task => (
              <button
                key={task.id}
                onClick={() => handleStartPomodoro(task)}
                className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/[0.04] transition-all truncate"
              >
                {task.title}
              </button>
            ))}
            {filteredTasks.length === 0 && search && (
              <div className="px-3 py-3 text-xs text-muted text-center">No matching tasks</div>
            )}
          </div>
          {state && state.totalSessionsToday > 0 && (
            <div className="px-3 py-1.5 border-t border-white/[0.04] text-[9px] text-muted text-center">
              {state.totalSessionsToday} session{state.totalSessionsToday !== 1 ? 's' : ''} today
            </div>
          )}
        </div>
      )}
    </div>
  )
}
