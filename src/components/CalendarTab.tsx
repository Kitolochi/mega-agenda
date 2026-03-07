import { useState, useEffect, useCallback, useMemo } from 'react'
import type { CalendarEvent, Task } from '../types'

type ViewMode = 'month' | 'week'

const ACCENT_COLORS: { key: string; label: string; bg: string; dot: string }[] = [
  { key: 'emerald', label: 'Emerald', bg: 'bg-accent-emerald/20', dot: 'bg-accent-emerald' },
  { key: 'blue', label: 'Blue', bg: 'bg-accent-blue/20', dot: 'bg-accent-blue' },
  { key: 'amber', label: 'Amber', bg: 'bg-accent-amber/20', dot: 'bg-accent-amber' },
  { key: 'purple', label: 'Purple', bg: 'bg-accent-purple/20', dot: 'bg-accent-purple' },
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const days = viewMode === 'month'
    ? getMonthDays(currentYear, currentMonth)
    : getWeekDays(new Date(selectedDate + 'T12:00:00'))

  const selectedLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

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

      {/* Right: Day Detail Panel */}
      <div className="w-80 border-l border-white/[0.06] bg-surface-1/30 p-5 overflow-auto flex flex-col">
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

        {dayTasks.length === 0 && dayEvents.length === 0 && !showAddForm && (
          <p className="text-xs text-muted/60 italic mb-4">No tasks or events</p>
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
    </div>
  )
}
