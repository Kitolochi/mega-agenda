import { useState, useEffect, useCallback } from 'react'
import { DailyNote } from '../types'

export default function DailyNotes() {
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set())

  const loadNote = useCallback(async () => {
    const note = await window.electronAPI.getDailyNote(currentDate)
    setContent(note?.content || '')
    setLastSaved(note?.updated_at || null)
  }, [currentDate])

  const loadNoteDates = useCallback(async () => {
    const notes = await window.electronAPI.getRecentNotes(365)
    setNoteDates(new Set(notes.map(n => n.date)))
  }, [])

  useEffect(() => { loadNote() }, [loadNote])
  useEffect(() => { loadNoteDates() }, [loadNoteDates])

  const saveNote = useCallback(async () => {
    if (content.trim() === '' && !lastSaved) return
    setIsSaving(true)
    const note = await window.electronAPI.saveDailyNote(currentDate, content)
    setLastSaved(note.updated_at)
    setNoteDates(prev => new Set([...prev, currentDate]))
    setIsSaving(false)
  }, [content, currentDate, lastSaved])

  useEffect(() => {
    const timer = setTimeout(() => { if (content || lastSaved) saveNote() }, 1000)
    return () => clearTimeout(timer)
  }, [content, saveNote, lastSaved])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const goToDay = (offset: number) => {
    const date = new Date(currentDate + 'T00:00:00')
    date.setDate(date.getDate() + offset)
    setCurrentDate(date.toISOString().split('T')[0])
  }

  const goToToday = () => setCurrentDate(new Date().toISOString().split('T')[0])
  const selectDate = (date: string) => { setCurrentDate(date); setShowCalendar(false) }
  const isToday = currentDate === new Date().toISOString().split('T')[0]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return { daysInMonth: lastDay.getDate(), startingDay: firstDay.getDay(), year, month }
  }

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(calendarMonth)
  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const calendarDays: (string | null)[] = []
  for (let i = 0; i < startingDay; i++) calendarDays.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }

  return (
    <div className="h-full flex flex-col p-4 animate-fade-in">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => goToDay(-1)}
          className="w-8 h-8 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-muted hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button onClick={() => setShowCalendar(!showCalendar)} className="text-center hover:bg-white/[0.03] px-4 py-1.5 rounded-lg transition-all">
          <p className="font-display font-semibold text-sm text-white/90">{formatDate(currentDate)}</p>
          {isToday && <p className="text-[10px] text-accent-blue">Today</p>}
        </button>

        <button
          onClick={() => goToDay(1)}
          className="w-8 h-8 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-muted hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Quick actions */}
      {!isToday && !showCalendar && (
        <button onClick={goToToday} className="mb-3 text-[11px] text-accent-blue hover:text-accent-blue/80 transition-colors self-center">
          Back to Today
        </button>
      )}

      {/* Calendar Dropdown */}
      {showCalendar && (
        <div className="mb-4 glass-card rounded-xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setCalendarMonth(new Date(year, month - 1))}
              className="w-7 h-7 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-muted transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-display font-semibold text-white/80">{monthName}</span>
            <button
              onClick={() => setCalendarMonth(new Date(year, month + 1))}
              className="w-7 h-7 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-muted transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-[10px] text-muted/50 py-1 font-medium">{d}</div>
            ))}
            {calendarDays.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />
              const day = parseInt(dateStr.split('-')[2])
              const hasNote = noteDates.has(dateStr)
              const isSelected = dateStr === currentDate
              const isTodayDate = dateStr === new Date().toISOString().split('T')[0]

              return (
                <button
                  key={i}
                  onClick={() => selectDate(dateStr)}
                  className={`py-1.5 rounded-lg text-[11px] relative transition-all ${
                    isSelected
                      ? 'bg-accent-blue text-white font-medium'
                      : isTodayDate
                      ? 'bg-white/[0.06] text-white'
                      : hasNote
                      ? 'text-accent-blue hover:bg-white/[0.04]'
                      : 'text-muted/70 hover:bg-white/[0.03] hover:text-white/70'
                  }`}
                >
                  {day}
                  {hasNote && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent-blue rounded-full" />
                  )}
                </button>
              )
            })}
          </div>

          <button onClick={goToToday} className="mt-3 w-full text-[11px] text-center text-accent-blue hover:text-accent-blue/80 py-1 transition-colors">
            Today
          </button>
        </div>
      )}

      {/* Notes Editor */}
      <div className="flex-1 flex flex-col glass-card rounded-xl overflow-hidden min-h-0">
        <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Notes</span>
          <span className={`text-[10px] transition-all ${
            isSaving ? 'text-accent-amber' : lastSaved ? 'text-accent-emerald/60' : 'text-transparent'
          }`}>
            {isSaving ? 'Saving...' : lastSaved ? 'Saved' : ''}
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your thoughts..."
          className="flex-1 w-full bg-transparent p-4 text-[13px] text-white/80 leading-relaxed focus:outline-none resize-none placeholder-muted/30"
        />
      </div>
    </div>
  )
}
