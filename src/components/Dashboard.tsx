import { useState, useEffect, useRef } from 'react'
import { Category, Task, Stats, PomodoroState, DailyNote, BankAccount, BankTransaction, BankConnection } from '../types'
import CategoryCard from './CategoryCard'
import TaskItem from './TaskItem'
import MorningBriefing from './MorningBriefing'
import ActivityHeatmap from './ActivityHeatmap'
import DebtSummary from './bank-sync/DebtSummary'
import { playClick } from '../utils/sounds'

interface DashboardProps {
  categories: Category[]
  tasks: Task[]
  stats: Stats | null
  onCategoryClick: (category: Category) => void
  onToggleTask: (id: number) => void
  onAddTask: (categoryId: number) => void
}

type ViewMode = 'categories' | 'high' | 'medium' | 'low'

function ProgressRing({ percent, size = 72, stroke = 5 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percent / 100) * circumference

  const getColor = (p: number) => {
    if (p >= 80) return '#34D399'
    if (p >= 50) return '#6C8EEF'
    if (p >= 25) return '#FBBF24'
    return '#3a3a46'
  }

  const color = getColor(percent)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke}
        />
        {/* Glow layer */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke + 4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring-circle"
          style={{ filter: 'blur(4px)', opacity: 0.3 }}
        />
        {/* Main arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring-circle"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-display font-bold text-white">{percent}%</span>
      </div>
    </div>
  )
}

function DueSoonWidget({ tasks, onToggleTask }: { tasks: Task[]; onToggleTask: (id: number) => void }) {
  const now = new Date()
  const threeDaysOut = new Date(now)
  threeDaysOut.setDate(threeDaysOut.getDate() + 3)
  const todayStr = now.toISOString().split('T')[0]
  const cutoffStr = threeDaysOut.toISOString().split('T')[0]

  const dueSoon = tasks
    .filter(t => !t.completed && t.due_date && t.due_date <= cutoffStr)
    .sort((a, b) => {
      if (a.due_date! < b.due_date!) return -1
      if (a.due_date! > b.due_date!) return 1
      return a.priority - b.priority
    })
    .slice(0, 5)

  if (dueSoon.length === 0) return null

  const getUrgencyLabel = (dueDate: string) => {
    if (dueDate < todayStr) return { text: 'Overdue', className: 'text-accent-red bg-accent-red/10' }
    if (dueDate === todayStr) return { text: 'Today', className: 'text-accent-amber bg-accent-amber/10' }
    const d = new Date(dueDate + 'T00:00:00')
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000)
    if (diffDays === 1) return { text: 'Tomorrow', className: 'text-accent-blue bg-accent-blue/10' }
    return { text: `${diffDays}d`, className: 'text-muted bg-white/[0.04]' }
  }

  return (
    <div className="glass-card rounded-xl p-3 hover-lift">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Due Soon</span>
        <span className="text-[10px] text-white/40">{dueSoon.length}</span>
      </div>
      <div className="space-y-1">
        {dueSoon.map(task => {
          const urgency = getUrgencyLabel(task.due_date!)
          return (
            <div key={task.id} className="flex items-center gap-2 group">
              <button
                onClick={() => onToggleTask(task.id)}
                className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0 hover:border-accent-emerald/60 hover:bg-accent-emerald/10 transition-all flex items-center justify-center"
              >
                <svg className="w-2.5 h-2.5 text-transparent group-hover:text-accent-emerald/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <span className="text-xs text-white/70 truncate flex-1">{task.title}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${urgency.className}`}>
                {urgency.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PomodoroWidget({ tasks }: { tasks: Task[] }) {
  const [state, setState] = useState<PomodoroState | null>(null)
  const [timeLeft, setTimeLeft] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    window.electronAPI.getPomodoroState().then(setState)
  }, [])

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
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state?.isRunning, state?.currentSession?.startedAt])

  const handleStart = async () => {
    const s = await window.electronAPI.startPomodoro(null, 'Free Focus', 25)
    setState(s)
  }

  const isRunning = state?.isRunning && state?.currentSession
  const isBreak = state?.currentSession?.type === 'short_break' || state?.currentSession?.type === 'long_break'

  return (
    <div className="glass-card rounded-xl p-3 hover-lift flex-1">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 7v5l3 3" />
        </svg>
        <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Focus</span>
        {state && state.totalSessionsToday > 0 && (
          <span className="text-[10px] text-white/40">{state.totalSessionsToday} today</span>
        )}
      </div>
      {isRunning ? (
        <div className="flex items-center gap-2">
          <span className={`text-lg font-mono font-bold ${isBreak ? 'text-accent-blue' : 'text-accent-emerald'}`}>
            {timeLeft}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted truncate">
              {isBreak ? 'Break' : state.currentSession?.taskTitle}
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-accent-emerald/10 text-accent-emerald text-xs font-medium hover:bg-accent-emerald/20 transition-all"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Start focus session
        </button>
      )}
    </div>
  )
}

function JournalSnippetWidget() {
  const [snippet, setSnippet] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    window.electronAPI.getDailyNote(today).then((note: DailyNote | null) => {
      if (note?.content) {
        const trimmed = note.content.trim()
        setSnippet(trimmed.length > 100 ? trimmed.slice(0, 100) + '...' : trimmed)
      }
    })
  }, [])

  return (
    <div className="glass-card rounded-xl p-3 hover-lift flex-1">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Journal</span>
      </div>
      {snippet ? (
        <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{snippet}</p>
      ) : (
        <p className="text-xs text-muted/40 italic">No entry today</p>
      )}
    </div>
  )
}

function FinancialSnapshotWidget() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [connections, setConnections] = useState<BankConnection[]>([])

  useEffect(() => {
    Promise.all([
      window.electronAPI.getBankAccounts(),
      window.electronAPI.getBankTransactions(undefined, 500),
      window.electronAPI.getBankConnections(),
    ]).then(([accts, txs, conns]) => {
      setAccounts(accts)
      setTransactions(txs)
      setConnections(conns)
    }).catch(() => {})
  }, [])

  if (connections.length === 0) return null

  const totalBalance = accounts.reduce((sum, a) => {
    if (a.accountType === 'credit_card' || a.accountType === 'loan' || a.accountType === 'mortgage') {
      return sum - Math.abs(a.balance)
    }
    return sum + a.balance
  }, 0)

  const todayStr = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]

  const spentToday = transactions
    .filter(tx => tx.date === todayStr && tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  const spentThisWeek = transactions
    .filter(tx => tx.date >= weekAgoStr && tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  const fmtCents = (c: number) => (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="glass-card rounded-xl p-3 hover-lift">
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Finances</span>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="flex-1">
          <p className="text-[9px] text-muted mb-0.5">Net Balance</p>
          <p className={`text-sm font-display font-bold ${totalBalance >= 0 ? 'text-accent-emerald' : 'text-accent-red'}`}>
            {totalBalance < 0 ? '-' : ''}${fmtCents(totalBalance)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-muted mb-0.5">Today</p>
          <p className="text-xs text-white/60">${fmtCents(spentToday)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-muted mb-0.5">This Week</p>
          <p className="text-xs text-white/60">${fmtCents(spentThisWeek)}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({
  categories, tasks, stats, onCategoryClick, onToggleTask, onAddTask
}: DashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('categories')

  const getTasksForCategory = (categoryId: number) => tasks.filter(t => t.category_id === categoryId)
  const getTasksByPriority = (priority: number) => tasks.filter(t => t.priority === priority && !t.completed)

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const pendingTasks = tasks.filter(t => !t.completed).length
  const highCount = getTasksByPriority(1).length
  const medCount = getTasksByPriority(2).length
  const lowCount = getTasksByPriority(3).length
  const getCategoryById = (id: number) => categories.find(c => c.id === id)

  const getMotivationalMessage = () => {
    if (overallProgress === 100) return "Everything done. Perfect."
    if (overallProgress >= 80) return "Nearly there. Finish strong."
    if (overallProgress >= 50) return "Solid progress. Keep moving."
    if (overallProgress >= 25) return "Getting traction. Push forward."
    if (highCount === 0 && pendingTasks > 0) return "No fires. Steady work."
    if (pendingTasks === 0) return "Clean slate. What's next?"
    return `${highCount} high priority ${highCount === 1 ? 'task' : 'tasks'} to tackle.`
  }

  return (
    <div className="p-4 space-y-3">
      {/* Morning Briefing */}
      <div className="animate-stagger-in" style={{ animationDelay: '0ms' }}>
        <MorningBriefing />
      </div>

      {/* Hero Stats Row */}
      <div className="flex gap-3 animate-stagger-in" style={{ animationDelay: '60ms' }}>
        {/* Progress Ring Card */}
        <div className="glass-card-elevated rounded-xl p-4 flex-1 flex items-center gap-4 hover-lift">
          <ProgressRing percent={overallProgress} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-0.5">Progress</p>
            <p className="text-xs text-white/60 mb-2">{getMotivationalMessage()}</p>
            <div className="flex gap-3">
              {[
                { color: 'bg-accent-red', count: highCount, label: 'High' },
                { color: 'bg-accent-amber', count: medCount, label: 'Med' },
                { color: 'bg-subtle', count: lowCount, label: 'Low' },
              ].map(p => (
                <div key={p.label} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.color} ${p.count > 0 ? 'animate-pulse-glow' : ''}`} />
                  <span className="text-[10px] text-muted">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Streak & Weekly Stats */}
      {stats && (
        <div className="flex gap-2 animate-stagger-in" style={{ animationDelay: '120ms' }}>
          <div className={`flex-1 glass-card stat-card rounded-xl p-3 relative overflow-hidden hover-lift ${stats.currentStreak > 0 ? 'streak-shimmer' : ''}`}>
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="w-8 h-8 rounded-lg bg-accent-orange/10 flex items-center justify-center">
                <span className={`text-base ${stats.currentStreak > 0 ? 'animate-pulse-glow' : ''}`}>{stats.currentStreak > 0 ? '🔥' : '💤'}</span>
              </div>
              <div>
                <p className="text-base font-display font-bold text-white">{stats.currentStreak}</p>
                <p className="text-[10px] text-muted leading-none">day streak</p>
              </div>
            </div>
          </div>
          <div className="flex-1 glass-card stat-card rounded-xl p-3 hover-lift">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <span className="text-base">⚡</span>
              </div>
              <div>
                <p className="text-base font-display font-bold text-white">{stats.tasksCompletedThisWeek}</p>
                <p className="text-[10px] text-muted leading-none">this week</p>
              </div>
            </div>
          </div>
          <div className="flex-1 glass-card stat-card rounded-xl p-3 hover-lift">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent-emerald/10 flex items-center justify-center">
                <span className="text-base">✓</span>
              </div>
              <div>
                <p className="text-base font-display font-bold text-white">{completedTasks}</p>
                <p className="text-[10px] text-muted leading-none">of {totalTasks} done</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Due Soon */}
      <div className="animate-stagger-in" style={{ animationDelay: '180ms' }}>
        <DueSoonWidget tasks={tasks} onToggleTask={onToggleTask} />
      </div>

      {/* Quick Widgets Row: Pomodoro + Journal */}
      <div className="flex gap-2 animate-stagger-in" style={{ animationDelay: '210ms' }}>
        <PomodoroWidget tasks={tasks} />
        <JournalSnippetWidget />
      </div>

      {/* Financial Snapshot */}
      <div className="animate-stagger-in" style={{ animationDelay: '240ms' }}>
        <FinancialSnapshotWidget />
      </div>

      {/* Activity Heatmap */}
      <div className="animate-stagger-in" style={{ animationDelay: '270ms' }}>
        <ActivityHeatmap />
      </div>

      {/* Debt Summary (shown only when bank connections exist) */}
      <div className="animate-stagger-in" style={{ animationDelay: '300ms' }}>
        <DebtSummary compact />
      </div>

      {/* View Tabs */}
      <div className="flex gap-0.5 bg-surface-2/80 rounded-xl p-0.5 animate-stagger-in" style={{ animationDelay: '330ms' }}>
        {[
          { mode: 'categories' as ViewMode, label: 'All', activeClass: 'bg-surface-4 text-white shadow-md shadow-black/20' },
          { mode: 'high' as ViewMode, label: 'Urgent', activeClass: 'bg-accent-red/15 text-accent-red shadow-md shadow-accent-red/5' },
          { mode: 'medium' as ViewMode, label: 'Medium', activeClass: 'bg-accent-amber/15 text-accent-amber shadow-md shadow-accent-amber/5' },
          { mode: 'low' as ViewMode, label: 'Later', activeClass: 'bg-surface-4 text-white/70 shadow-md shadow-black/20' },
        ].map(tab => (
          <button
            key={tab.mode}
            onClick={() => { setViewMode(tab.mode); playClick() }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all duration-200 press-effect ${
              viewMode === tab.mode ? tab.activeClass : 'text-muted hover:text-white/60 hover:bg-white/[0.03]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'categories' ? (
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((category, i) => (
            <div key={category.id} className="animate-stagger-in" style={{ animationDelay: `${390 + i * 50}ms` }}>
              <CategoryCard
                category={category}
                tasks={getTasksForCategory(category.id)}
                onClick={() => onCategoryClick(category)}
                onToggleTask={onToggleTask}
                onAddTask={() => onAddTask(category.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {getTasksByPriority(viewMode === 'high' ? 1 : viewMode === 'medium' ? 2 : 3).length === 0 ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-surface-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-muted">No {viewMode} priority tasks</p>
            </div>
          ) : (
            getTasksByPriority(viewMode === 'high' ? 1 : viewMode === 'medium' ? 2 : 3).map((task, i) => {
              const category = getCategoryById(task.category_id)
              return (
                <div key={task.id} className="relative animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <TaskItem task={task} onToggle={() => onToggleTask(task.id)} />
                  {category && (
                    <span
                      className="absolute top-2.5 right-2.5 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                      style={{ backgroundColor: category.color + '15', color: category.color }}
                    >
                      {category.icon} {category.name}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
