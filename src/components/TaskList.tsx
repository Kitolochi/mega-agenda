import { useState } from 'react'
import { Task, Category } from '../types'

interface TaskListProps {
  tasks: Task[]
  categories: Category[]
  onToggleTask: (id: number) => void
}

export default function TaskList({ tasks, categories, onToggleTask }: TaskListProps) {
  const [showDone, setShowDone] = useState(false)

  const getCategoryById = (id: number) => categories.find(c => c.id === id)

  const pending = tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      // Priority: 1 (high) first
      if (a.priority !== b.priority) return a.priority - b.priority
      // Due date: soonest first (no date = last)
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date && !b.due_date) return -1
      if (!a.due_date && b.due_date) return 1
      // Creation date: oldest first
      return a.created_at.localeCompare(b.created_at)
    })

  const done = tasks.filter(t => t.completed)

  const formatDue = (dateStr?: string) => {
    if (!dateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dateStr + 'T00:00:00')
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, overdue: true }
    if (diffDays === 0) return { text: 'Today', overdue: false }
    if (diffDays === 1) return { text: 'Tomorrow', overdue: false }
    if (diffDays < 7) return { text: `${diffDays}d`, overdue: false }
    return { text: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: false }
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">Priority List</span>
            <span className="text-[10px] text-muted/50">{pending.length} pending</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {pending.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-surface-2 flex items-center justify-center">
              <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-white/60">All clear</p>
            <p className="text-[11px] text-muted mt-1">No pending tasks</p>
          </div>
        ) : (
          <div className="space-y-1">
            {pending.map((task, i) => {
              const cat = getCategoryById(task.category_id)
              const due = formatDue(task.due_date)
              return (
                <ListRow
                  key={task.id}
                  task={task}
                  category={cat}
                  due={due}
                  onToggle={() => onToggleTask(task.id)}
                  index={i}
                />
              )
            })}
          </div>
        )}

        {/* Completed section */}
        {done.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowDone(!showDone)}
              className="flex items-center gap-2 px-1 mb-2 text-[10px] uppercase tracking-widest text-muted font-display font-medium hover:text-white/60 transition-colors"
            >
              <svg className={`w-3 h-3 transition-transform ${showDone ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Completed
              <span className="text-muted/50 normal-case tracking-normal">{done.length}</span>
            </button>
            {showDone && (
              <div className="space-y-1 animate-fade-in">
                {done.map((task, i) => {
                  const cat = getCategoryById(task.category_id)
                  return (
                    <ListRow
                      key={task.id}
                      task={task}
                      category={cat}
                      due={null}
                      onToggle={() => onToggleTask(task.id)}
                      index={i}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ListRow({ task, category, due, onToggle, index }: {
  task: Task
  category: Category | undefined
  due: { text: string; overdue: boolean } | null
  onToggle: () => void
  index: number
}) {
  const [animating, setAnimating] = useState(false)

  const handleToggle = () => {
    if (!task.completed) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 500)
    }
    onToggle()
  }

  const priorityColors = { 1: 'border-accent-red', 2: 'border-accent-amber', 3: 'border-subtle' }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 animate-slide-up ${
        task.completed ? 'opacity-40' : 'glass-card'
      } ${animating ? 'scale-[0.97] bg-accent-emerald/10' : ''}`}
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <button
        onClick={handleToggle}
        className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
          task.completed ? 'bg-accent-emerald border-accent-emerald' : priorityColors[task.priority as 1|2|3]
        } ${animating ? 'scale-125' : 'hover:scale-110'}`}
      >
        {task.completed && (
          <svg className={`w-2.5 h-2.5 text-white ${animating ? 'animate-check-pop' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${task.completed ? 'line-through text-muted' : 'text-white/90'}`}>
          {task.title}
        </p>
        {task.description && !task.completed && (
          <p className="text-[10px] text-muted mt-0.5 truncate">{task.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {due && !task.completed && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
            due.overdue ? 'bg-accent-red/10 text-accent-red' : 'bg-surface-3 text-muted'
          }`}>
            {due.text}
          </span>
        )}
        {category && !task.completed && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: category.color + '15', color: category.color }}
          >
            {category.icon}
          </span>
        )}
        {!task.completed && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
            task.priority === 1 ? 'bg-accent-red/10 text-accent-red' :
            task.priority === 2 ? 'bg-accent-amber/10 text-accent-amber' :
            'bg-surface-3 text-muted'
          }`}>
            {task.priority === 1 ? 'High' : task.priority === 2 ? 'Med' : 'Low'}
          </span>
        )}
      </div>
    </div>
  )
}
