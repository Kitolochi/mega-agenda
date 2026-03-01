import { useState } from 'react'
import { Category, Task, Stats } from '../types'
import CategoryCard from './CategoryCard'
import TaskItem from './TaskItem'
import MorningBriefing from './MorningBriefing'
import ActivityHeatmap from './ActivityHeatmap'
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

      {/* Activity Heatmap */}
      <div className="animate-stagger-in" style={{ animationDelay: '180ms' }}>
        <ActivityHeatmap />
      </div>

      {/* View Tabs */}
      <div className="flex gap-0.5 bg-surface-2/80 rounded-xl p-0.5 animate-stagger-in" style={{ animationDelay: '240ms' }}>
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
            <div key={category.id} className="animate-stagger-in" style={{ animationDelay: `${300 + i * 50}ms` }}>
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
