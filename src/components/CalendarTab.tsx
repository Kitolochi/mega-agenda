import { useState, useEffect, useCallback, useMemo } from 'react'
import type { CalendarEvent, Task, Routine, RoutineResult } from '../types'

type ViewMode = 'month' | 'week'

const ACCENT_COLORS: { key: string; label: string; bg: string; dot: string }[] = [
  { key: 'emerald', label: 'Emerald', bg: 'bg-accent-emerald/20', dot: 'bg-accent-emerald' },
  { key: 'blue', label: 'Blue', bg: 'bg-accent-blue/20', dot: 'bg-accent-blue' },
  { key: 'amber', label: 'Amber', bg: 'bg-accent-amber/20', dot: 'bg-accent-amber' },
  { key: 'purple', label: 'Purple', bg: 'bg-accent-purple/20', dot: 'bg-accent-purple' },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ROUTINE_TYPES: { value: Routine['type']; label: string }[] = [
  { value: 'morning-briefing', label: 'Morning Briefing' },
  { value: 'pr-monitor', label: 'PR Monitor' },
  { value: 'email-digest', label: 'Email Digest' },
  { value: 'weekly-review', label: 'Weekly Review' },
  { value: 'custom', label: 'Custom Command' },
]

const TRIGGER_TYPES: { value: Routine['schedule']['trigger']; label: string }[] = [
  { value: 'app-launch', label: 'App Launch' },
  { value: 'interval', label: 'Interval' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getMonthDays(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDay = first.getDay()
  const days: { date: Date; inMonth: boolean }[] = []

  // Fill preceding days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, inMonth: false })
  }
  // Current month days
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true })
  }
  // Fill remaining to complete 6-row grid (42 cells)
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startDay - last.getDate() + 1)
    days.push({ date: d, inMonth: false })
  }
  return days
}

function getWeekDays(selectedDate: Date): { date: Date; inMonth: boolean }[] {
  const day = selectedDate.getDay()
  const start = new Date(selectedDate)
  start.setDate(start.getDate() - day)
  const days: { date: Date; inMonth: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push({ date: d, inMonth: true })
  }
  return days
}

function describeSchedule(routine: Routine): string {
  const s = routine.schedule
  switch (s.trigger) {
    case 'app-launch': return 'On app launch (once/day)'
    case 'interval': return `Every ${s.intervalMinutes || 60}min`
    case 'daily': return s.time ? `Daily at ${s.time}` : 'Daily'
    case 'weekly': {
      const day = DAY_NAMES[s.dayOfWeek ?? 1]
      return s.time ? `${day} at ${s.time}` : `Every ${day}`
    }
    default: return 'Unknown'
  }
}

export default function CalendarTab() {
  const today = useMemo(() => formatDate(new Date()), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [dayTasks, setDayTasks] = useState<Task[]>([])
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [gwsAuth, setGwsAuth] = useState<{ installed: boolean; authenticated: boolean } | null>(null)

  // Add form state
  const [formTitle, setFormTitle] = useState('')
  const [formStartTime, setFormStartTime] = useState('')
  const [formEndTime, setFormEndTime] = useState('')
  const [formColor, setFormColor] = useState('emerald')
  const [formDescription, setFormDescription] = useState('')
  const [formAllDay, setFormAllDay] = useState(false)
  const [formRecurring, setFormRecurring] = useState(false)

  // History state
  const [rightPanel, setRightPanel] = useState<'day' | 'history' | 'routines'>('day')
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyTasks, setHistoryTasks] = useState<Task[]>([])
  const [historyEvents, setHistoryEvents] = useState<CalendarEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Routines state
  const [routines, setRoutines] = useState<Routine[]>([])
  const [dayRoutineResults, setDayRoutineResults] = useState<RoutineResult[]>([])
  const [showAddRoutine, setShowAddRoutine] = useState(false)
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null)
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null)

  // Add routine form
  const [rName, setRName] = useState('')
  const [rType, setRType] = useState<Routine['type']>('morning-briefing')
  const [rTrigger, setRTrigger] = useState<Routine['schedule']['trigger']>('app-launch')
  const [rTime, setRTime] = useState('')
  const [rInterval, setRInterval] = useState('60')
  const [rDayOfWeek, setRDayOfWeek] = useState('1')
  const [rCommand, setRCommand] = useState('')

  // Check gws auth on mount
  useEffect(() => {
    window.electronAPI.gwsCheckAuth().then(status => {
      setGwsAuth({ installed: status.installed, authenticated: status.authenticated })
    }).catch(() => setGwsAuth(null))
  }, [])

  // Load month events
  const loadEvents = useCallback(async () => {
    const startDate = formatDate(new Date(currentYear, currentMonth, 1))
    const endDate = formatDate(new Date(currentYear, currentMonth + 1, 0))
    try {
      const data = await window.electronAPI.getCalendarEvents(startDate, endDate)
      setEvents(data)
    } catch { /* ignore */ }
  }, [currentYear, currentMonth])

  useEffect(() => { loadEvents() }, [loadEvents])

  // Load selected day agenda
  const loadDayAgenda = useCallback(async () => {
    try {
      const agenda = await window.electronAPI.getDailyAgenda(selectedDate)
      setDayTasks(agenda.tasks)
      setDayEvents(agenda.events)
    } catch { /* ignore */ }
  }, [selectedDate])

  useEffect(() => { loadDayAgenda() }, [loadDayAgenda])

  // Load history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await window.electronAPI.getCalendarHistory(historyQuery, 50)
      setHistoryTasks(data.tasks)
      setHistoryEvents(data.events)
    } catch { /* ignore */ }
    setHistoryLoading(false)
  }, [historyQuery])

  useEffect(() => {
    if (rightPanel === 'history') loadHistory()
  }, [rightPanel, loadHistory])

  // Load routines
  const loadRoutines = useCallback(async () => {
    try {
      const data = await window.electronAPI.getRoutines()
      setRoutines(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadRoutines() }, [loadRoutines])

  // Load routine results for selected day
  const loadDayRoutineResults = useCallback(async () => {
    try {
      const data = await window.electronAPI.getRoutineResultsForDate(selectedDate)
      setDayRoutineResults(data)
    } catch { /* ignore */ }
  }, [selectedDate])

  useEffect(() => { loadDayRoutineResults() }, [loadDayRoutineResults])

  // Listen for routines-updated events
  useEffect(() => {
    const cleanup = window.electronAPI.onRoutinesUpdated(() => {
      loadRoutines()
      loadDayRoutineResults()
    })
    return cleanup
  }, [loadRoutines, loadDayRoutineResults])

  // Build a lookup: date string -> { tasks: boolean, events: boolean, gcal: boolean }
  const dateMarkers = useMemo(() => {
    const map: Record<string, { hasTask: boolean; hasEvent: boolean; hasGcal: boolean }> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = { hasTask: false, hasEvent: false, hasGcal: false }
      if (e.source === 'gcal') map[e.date].hasGcal = true
      else map[e.date].hasEvent = true
    }
    return map
  }, [events])

  // Also mark task dates (we need tasks for the visible range)
  const [taskDateSet, setTaskDateSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    const startDate = formatDate(new Date(currentYear, currentMonth, 1))
    const endDate = formatDate(new Date(currentYear, currentMonth + 1, 0))
    window.electronAPI.getTasks().then(tasks => {
      const dates = new Set<string>()
      for (const t of tasks) {
        if (!t.completed && t.due_date && t.due_date >= startDate && t.due_date <= endDate) {
          dates.add(t.due_date)
        }
      }
      setTaskDateSet(dates)
    }).catch(() => {})
  }, [currentYear, currentMonth])

  const navigateMonth = (delta: number) => {
    let m = currentMonth + delta
    let y = currentYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setCurrentMonth(m)
    setCurrentYear(y)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await window.electronAPI.syncGcalEvents()
      await loadEvents()
      await loadDayAgenda()
    } catch { /* ignore */ }
    setSyncing(false)
  }

  const handleAddEvent = async () => {
    if (!formTitle.trim()) return
    await window.electronAPI.createCalendarEvent({
      title: formTitle.trim(),
      description: formDescription,
      date: selectedDate,
      startTime: formStartTime,
      endTime: formEndTime,
      color: formColor,
      source: 'manual',
      ...(formRecurring ? { recurrence: 'weekly' as const } : {}),
    })
    setFormTitle('')
    setFormStartTime('')
    setFormEndTime('')
    setFormColor('emerald')
    setFormDescription('')
    setFormAllDay(false)
    setFormRecurring(false)
    setShowAddForm(false)
    await loadEvents()
    await loadDayAgenda()
  }

  const handleDeleteEvent = async (id: string) => {
    await window.electronAPI.deleteCalendarEvent(id)
    await loadEvents()
    await loadDayAgenda()
  }

  const handleToggleTask = async (taskId: number) => {
    await window.electronAPI.toggleTask(taskId)
    await loadDayAgenda()
  }

  // Routine handlers
  const handleRunRoutine = async (id: string) => {
    setRunningRoutineId(id)
    try {
      await window.electronAPI.runRoutine(id)
      await loadRoutines()
      await loadDayRoutineResults()
    } catch { /* ignore */ }
    setRunningRoutineId(null)
  }

  const handleToggleRoutine = async (id: string, enabled: boolean) => {
    await window.electronAPI.updateRoutine(id, { enabled })
    await loadRoutines()
  }

  const handleDeleteRoutine = async (id: string) => {
    await window.electronAPI.deleteRoutine(id)
    await loadRoutines()
    await loadDayRoutineResults()
  }

  const handleAddRoutine = async () => {
    if (!rName.trim()) return
    const config: Record<string, any> = {}
    if (rType === 'custom') config.command = rCommand

    await window.electronAPI.createRoutine({
      name: rName.trim(),
      type: rType,
      schedule: {
        trigger: rTrigger,
        ...(rTrigger === 'daily' || rTrigger === 'weekly' ? { time: rTime || undefined } : {}),
        ...(rTrigger === 'interval' ? { intervalMinutes: parseInt(rInterval) || 60 } : {}),
        ...(rTrigger === 'weekly' ? { dayOfWeek: parseInt(rDayOfWeek) } : {}),
      },
      config,
      enabled: true,
    })
    setRName('')
    setRType('morning-briefing')
    setRTrigger('app-launch')
    setRTime('')
    setRInterval('60')
    setRDayOfWeek('1')
    setRCommand('')
    setShowAddRoutine(false)
    await loadRoutines()
  }

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const days = viewMode === 'month'
    ? getMonthDays(currentYear, currentMonth)
    : getWeekDays(new Date(selectedDate + 'T12:00:00'))

  const selectedLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // Map routineId -> routine name for result cards
  const routineNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const r of routines) map[r.id] = r.name
    return map
  }, [routines])

  return (
    <div className="flex h-full">
      {/* Left: Calendar Grid */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Calendar</h1>
            <p className="text-xs text-muted mt-0.5">Tasks & events at a glance</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-surface-2/50 rounded-lg border border-white/[0.06] p-0.5">
              {(['month', 'week'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    viewMode === mode
                      ? 'bg-accent-blue/20 text-accent-blue'
                      : 'text-muted hover:text-white/70'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            {/* Google Calendar sync button */}
            {gwsAuth?.installed && (
              <button
                onClick={handleSync}
                disabled={syncing || !gwsAuth.authenticated}
                title={!gwsAuth.authenticated ? 'gws not authenticated. Run: gws auth login' : 'Sync Google Calendar'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  gwsAuth.authenticated
                    ? 'border-accent-purple/30 text-accent-purple hover:bg-accent-purple/10'
                    : 'border-white/[0.06] text-muted cursor-not-allowed opacity-50'
                }`}
              >
                <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
            )}
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/[0.06] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-medium text-white">{monthLabel}</span>
          <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/[0.06] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Day name headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-muted py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06]">
          {days.map(({ date, inMonth }, i) => {
            const dateStr = formatDate(date)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const markers = dateMarkers[dateStr]
            const hasTask = taskDateSet.has(dateStr)

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative min-h-[72px] p-1.5 text-left transition-all ${
                  inMonth ? 'bg-surface-1/30' : 'bg-surface-0/50'
                } ${isSelected ? 'ring-1 ring-accent-emerald/50 bg-accent-emerald/[0.05]' : 'hover:bg-white/[0.04]'}`}
              >
                <span className={`text-[11px] font-medium inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isToday ? 'bg-accent-emerald text-surface-0 font-bold' : inMonth ? 'text-white/80' : 'text-muted/40'
                }`}>
                  {date.getDate()}
                </span>
                {/* Dots for events/tasks */}
                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                  {hasTask && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />}
                  {markers?.hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald" />}
                  {markers?.hasGcal && <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div className="w-80 border-l border-white/[0.06] bg-surface-1/30 flex flex-col overflow-hidden">
        {/* Panel tabs */}
        <div className="flex border-b border-white/[0.06] px-3 pt-3 pb-0 gap-1">
          {(['day', 'history', 'routines'] as const).map(panel => (
            <button
              key={panel}
              onClick={() => setRightPanel(panel)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-t-lg transition-all ${
                rightPanel === panel
                  ? 'bg-surface-2/50 text-white border border-white/[0.06] border-b-transparent -mb-px'
                  : 'text-muted hover:text-white/70'
              }`}
            >
              {panel === 'day' ? 'Day' : panel === 'history' ? 'History' : 'Routines'}
            </button>
          ))}
        </div>

        {rightPanel === 'day' ? (
          /* Day detail panel */
          <div className="flex-1 overflow-auto p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-white mb-1">{selectedLabel}</h2>
            {selectedDate === today && (
              <span className="text-[10px] font-medium text-accent-emerald mb-3 inline-block">Today</span>
            )}
            {selectedDate !== today && <div className="mb-3" />}

            {/* Tasks Due */}
            {dayTasks.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Tasks Due</h3>
                <div className="space-y-1.5">
                  {dayTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2/40 border border-white/[0.04] group">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="w-4 h-4 rounded border border-accent-blue/50 flex items-center justify-center hover:bg-accent-blue/20 transition-colors flex-shrink-0"
                      >
                        {task.completed ? (
                          <svg className="w-3 h-3 text-accent-blue" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : null}
                      </button>
                      <span className="text-xs text-white/90 flex-1 truncate">{task.title}</span>
                      {task.priority === 1 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">High</span>
                      )}
                      {task.priority === 2 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">Med</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {dayEvents.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Events</h3>
                <div className="space-y-1.5">
                  {dayEvents.map(event => {
                    const colorDef = ACCENT_COLORS.find(c => c.key === event.color) || ACCENT_COLORS[0]
                    return (
                      <div key={event.id} className="flex items-start gap-2 p-2 rounded-lg bg-surface-2/40 border border-white/[0.04] group">
                        <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${colorDef.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white/90 truncate">{event.title}</span>
                            {event.recurrence === 'weekly' && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-accent-blue/20 text-accent-blue font-medium flex-shrink-0">Weekly</span>
                            )}
                            {event.source === 'gcal' && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-accent-purple/20 text-accent-purple font-medium flex-shrink-0">GCal</span>
                            )}
                          </div>
                          {event.startTime && (
                            <span className="text-[10px] text-muted">
                              {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                            </span>
                          )}
                          {!event.startTime && (
                            <span className="text-[10px] text-muted">All day</span>
                          )}
                        </div>
                        {event.source === 'manual' && (
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all p-0.5"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Routine Results for this day */}
            {dayRoutineResults.length > 0 && (
              <div className="mb-4">
                <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Routine Results</h3>
                <div className="space-y-1.5">
                  {dayRoutineResults.map(result => {
                    const isExpanded = expandedResultId === result.id
                    return (
                      <div key={result.id} className="rounded-lg bg-surface-2/40 border border-white/[0.04] overflow-hidden">
                        <button
                          onClick={() => setExpandedResultId(isExpanded ? null : result.id)}
                          className="w-full flex items-start gap-2 p-2 text-left hover:bg-white/[0.02] transition-colors"
                        >
                          <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                            result.status === 'success' ? 'bg-accent-emerald' : 'bg-red-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-white/90 truncate">
                                {routineNameMap[result.routineId] || 'Routine'}
                              </span>
                              <span className={`text-[8px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${
                                result.status === 'success'
                                  ? 'bg-accent-emerald/20 text-accent-emerald'
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {result.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted truncate block">{result.summary}</span>
                            <span className="text-[9px] text-muted/50">
                              {new Date(result.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          <svg className={`w-3 h-3 text-muted flex-shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-white/[0.04]">
                            <pre className="text-[10px] text-white/70 whitespace-pre-wrap mt-2 font-sans leading-relaxed max-h-48 overflow-auto">
                              {result.detail}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {dayTasks.length === 0 && dayEvents.length === 0 && dayRoutineResults.length === 0 && !showAddForm && (
              <p className="text-xs text-muted/60 italic mb-4">No tasks, events, or routine results</p>
            )}

            {/* Add Event Form */}
            {showAddForm ? (
              <div className="mt-auto bg-surface-2/50 rounded-xl border border-white/[0.06] p-3 space-y-2.5">
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Event title"
                  autoFocus
                  className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-accent-emerald/50"
                />
                {/* Full day toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => {
                      setFormAllDay(!formAllDay)
                      if (!formAllDay) { setFormStartTime(''); setFormEndTime('') }
                    }}
                    className={`relative w-8 h-4 rounded-full transition-colors ${formAllDay ? 'bg-accent-emerald/60' : 'bg-white/[0.1]'}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${formAllDay ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-[11px] text-muted">Full day</span>
                </label>
                {/* Repeat weekly toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setFormRecurring(!formRecurring)}
                    className={`relative w-8 h-4 rounded-full transition-colors ${formRecurring ? 'bg-accent-blue/60' : 'bg-white/[0.1]'}`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${formRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-[11px] text-muted">Repeat weekly</span>
                </label>
                {/* Time pickers (hidden when full day) */}
                {!formAllDay && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted mb-0.5 block">Start</label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={e => setFormStartTime(e.target.value)}
                        className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-emerald/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted mb-0.5 block">End</label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={e => setFormEndTime(e.target.value)}
                        className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-emerald/50"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-1.5">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setFormColor(c.key)}
                      className={`w-5 h-5 rounded-full ${c.dot} transition-all ${
                        formColor === c.key ? 'ring-2 ring-white/50 scale-110' : 'opacity-50 hover:opacity-80'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-muted/50 resize-none focus:outline-none focus:ring-1 focus:ring-accent-emerald/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddEvent}
                    disabled={!formTitle.trim()}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/20 hover:bg-accent-emerald/30 transition-colors disabled:opacity-40"
                  >
                    Add Event
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted hover:text-white border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-muted hover:text-accent-emerald border border-dashed border-white/[0.08] hover:border-accent-emerald/30 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Event
              </button>
            )}
          </div>
        ) : rightPanel === 'history' ? (
          /* History panel */
          <div className="flex-1 overflow-auto p-5 flex flex-col">
            {/* Search */}
            <div className="relative mb-4">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={historyQuery}
                onChange={e => setHistoryQuery(e.target.value)}
                placeholder="Search completed tasks & past events..."
                className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
              />
              {historyQuery && (
                <button
                  onClick={() => setHistoryQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {historyLoading ? (
              <p className="text-xs text-muted/60 italic">Loading...</p>
            ) : (
              <>
                {/* Completed tasks */}
                {historyTasks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                      Completed Tasks ({historyTasks.length})
                    </h3>
                    <div className="space-y-1">
                      {historyTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2/30 border border-white/[0.03]">
                          <svg className="w-3.5 h-3.5 text-accent-emerald flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-white/70 truncate block">{task.title}</span>
                            {task.updated_at && (
                              <span className="text-[10px] text-muted/50">
                                {new Date(task.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Past events */}
                {historyEvents.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                      Past Events ({historyEvents.length})
                    </h3>
                    <div className="space-y-1">
                      {historyEvents.map(event => {
                        const colorDef = ACCENT_COLORS.find(c => c.key === event.color) || ACCENT_COLORS[0]
                        return (
                          <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2/30 border border-white/[0.03]">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorDef.dot}`} />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-white/70 truncate block">{event.title}</span>
                              <span className="text-[10px] text-muted/50">
                                {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {event.startTime ? ` at ${event.startTime}` : ''}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {historyTasks.length === 0 && historyEvents.length === 0 && (
                  <p className="text-xs text-muted/60 italic">
                    {historyQuery ? 'No matches found' : 'No completed tasks or past events yet'}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          /* Routines panel */
          <div className="flex-1 overflow-auto p-5 flex flex-col">
            {routines.length > 0 && (
              <div className="space-y-2 mb-4">
                {routines.map(routine => (
                  <div key={routine.id} className="p-2.5 rounded-lg bg-surface-2/40 border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Enable/disable toggle */}
                      <button
                        onClick={() => handleToggleRoutine(routine.id, !routine.enabled)}
                        className={`relative w-7 h-3.5 rounded-full transition-colors flex-shrink-0 ${routine.enabled ? 'bg-accent-emerald/60' : 'bg-white/[0.1]'}`}
                      >
                        <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${routine.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className={`text-xs font-medium flex-1 truncate ${routine.enabled ? 'text-white/90' : 'text-muted/60'}`}>
                        {routine.name}
                      </span>
                      {/* Run button */}
                      <button
                        onClick={() => handleRunRoutine(routine.id)}
                        disabled={runningRoutineId === routine.id}
                        className="text-accent-blue hover:text-accent-blue/80 disabled:opacity-40 p-0.5"
                        title="Run now"
                      >
                        {runningRoutineId === routine.id ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        )}
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteRoutine(routine.id)}
                        className="text-muted hover:text-red-400 p-0.5"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted ml-9">
                      <span className="px-1.5 py-0.5 rounded bg-surface-0/50 border border-white/[0.04]">
                        {ROUTINE_TYPES.find(t => t.value === routine.type)?.label || routine.type}
                      </span>
                      <span>{describeSchedule(routine)}</span>
                    </div>
                    {routine.lastRun && (
                      <div className="text-[9px] text-muted/50 ml-9 mt-1">
                        Last: {new Date(routine.lastRun).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {routines.length === 0 && !showAddRoutine && (
              <p className="text-xs text-muted/60 italic mb-4">
                No routines configured. Add one to automate recurring tasks.
              </p>
            )}

            {/* Add Routine Form */}
            {showAddRoutine ? (
              <div className="mt-auto bg-surface-2/50 rounded-xl border border-white/[0.06] p-3 space-y-2.5">
                <input
                  value={rName}
                  onChange={e => setRName(e.target.value)}
                  placeholder="Routine name"
                  autoFocus
                  className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-muted/50 focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                />
                {/* Type */}
                <div>
                  <label className="text-[10px] text-muted mb-0.5 block">Type</label>
                  <select
                    value={rType}
                    onChange={e => setRType(e.target.value as Routine['type'])}
                    className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                  >
                    {ROUTINE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {/* Trigger */}
                <div>
                  <label className="text-[10px] text-muted mb-0.5 block">Schedule</label>
                  <select
                    value={rTrigger}
                    onChange={e => setRTrigger(e.target.value as Routine['schedule']['trigger'])}
                    className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                  >
                    {TRIGGER_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {/* Conditional fields */}
                {(rTrigger === 'daily' || rTrigger === 'weekly') && (
                  <div>
                    <label className="text-[10px] text-muted mb-0.5 block">Time</label>
                    <input
                      type="time"
                      value={rTime}
                      onChange={e => setRTime(e.target.value)}
                      className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                    />
                  </div>
                )}
                {rTrigger === 'weekly' && (
                  <div>
                    <label className="text-[10px] text-muted mb-0.5 block">Day</label>
                    <select
                      value={rDayOfWeek}
                      onChange={e => setRDayOfWeek(e.target.value)}
                      className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                    >
                      {DAY_NAMES.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                {rTrigger === 'interval' && (
                  <div>
                    <label className="text-[10px] text-muted mb-0.5 block">Interval (minutes)</label>
                    <input
                      type="number"
                      value={rInterval}
                      onChange={e => setRInterval(e.target.value)}
                      min="1"
                      className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                    />
                  </div>
                )}
                {rType === 'custom' && (
                  <div>
                    <label className="text-[10px] text-muted mb-0.5 block">Command</label>
                    <input
                      value={rCommand}
                      onChange={e => setRCommand(e.target.value)}
                      placeholder="echo hello world"
                      className="w-full bg-surface-0/50 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder-muted/50 font-mono focus:outline-none focus:ring-1 focus:ring-accent-blue/50"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddRoutine}
                    disabled={!rName.trim()}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-blue/20 text-accent-blue border border-accent-blue/20 hover:bg-accent-blue/30 transition-colors disabled:opacity-40"
                  >
                    Add Routine
                  </button>
                  <button
                    onClick={() => setShowAddRoutine(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted hover:text-white border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddRoutine(true)}
                className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-muted hover:text-accent-blue border border-dashed border-white/[0.08] hover:border-accent-blue/30 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Routine
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
