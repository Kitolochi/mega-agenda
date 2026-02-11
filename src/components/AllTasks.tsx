import { useState } from 'react'
import { Task, Category } from '../types'

interface AllTasksProps {
  tasks: Task[]
  categories: Category[]
  onToggleTask: (id: number) => void
}

type Filter = 'pending' | 'done'

export default function AllTasks({ tasks, categories, onToggleTask }: AllTasksProps) {
  const [filter, setFilter] = useState<Filter>('pending')

  const getCategoryById = (id: number) => categories.find(c => c.id === id)

  const today = new Date().toISOString().split('T')[0]

  const pendingTasks = tasks.filter(t => !t.completed)
  const doneTasks = tasks.filter(t => t.completed)
  const doneToday = doneTasks.filter(t => t.updated_at?.startsWith(today))

  const displayTasks = filter === 'pending' ? pendingTasks : doneTasks

  // Group by category
  const grouped = displayTasks.reduce((acc, task) => {
    const cat = getCategoryById(task.category_id)
    const key = cat?.name || 'Other'
    if (!acc[key]) acc[key] = { category: cat, tasks: [] }
    acc[key].tasks.push(task)
    return acc
  }, {} as Record<string, { category: Category | undefined; tasks: Task[] }>)

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Filter tabs */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
          <button
            onClick={() => setFilter('pending')}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              filter === 'pending'
                ? 'bg-surface-4 text-white shadow-sm'
                : 'text-muted hover:text-white/60'
            }`}
          >
            <span>To Do</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              filter === 'pending' ? 'bg-accent-blue/15 text-accent-blue' : 'bg-surface-3 text-muted'
            }`}>{pendingTasks.length}</span>
          </button>
          <button
            onClick={() => setFilter('done')}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              filter === 'done'
                ? 'bg-accent-emerald/15 text-accent-emerald shadow-sm'
                : 'text-muted hover:text-white/60'
            }`}
          >
            <span>Done</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
              filter === 'done' ? 'bg-accent-emerald/15 text-accent-emerald' : 'bg-surface-3 text-muted'
            }`}>{doneTasks.length}</span>
          </button>
        </div>

        {/* Today summary */}
        {filter === 'done' && doneToday.length > 0 && (
          <div className="mt-2 px-1">
            <p className="text-[10px] text-accent-emerald/70">{doneToday.length} completed today</p>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto px-4 pb-4 space-y-4">
        {displayTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-surface-2 flex items-center justify-center">
              {filter === 'pending' ? (
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              )}
            </div>
            <p className="text-sm text-white/60">{filter === 'pending' ? 'All caught up!' : 'Nothing done yet'}</p>
            <p className="text-[11px] text-muted mt-1">{filter === 'pending' ? 'No pending tasks' : 'Complete tasks to see them here'}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([name, { category, tasks: catTasks }]) => (
            <div key={name}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                {category && (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: category.color + '15' }}
                  >
                    {category.icon}
                  </div>
                )}
                <span className="text-[10px] uppercase tracking-widest text-muted font-display font-medium">{name}</span>
                <span className="text-[10px] text-muted/50">{catTasks.length}</span>
                <div className="flex-1 h-px bg-white/[0.03]" />
              </div>

              {/* Tasks */}
              <div className="space-y-1">
                {catTasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    category={category}
                    onToggle={() => onToggleTask(task.id)}
                    index={i}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, category, onToggle, index }: {
  task: Task
  category: Category | undefined
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
        task.completed ? 'opacity-50' : 'glass-card'
      } ${animating ? 'scale-[0.97] bg-accent-emerald/10' : ''} ${
        !task.completed && task.priority === 1 ? 'border-accent-red/10' : ''
      }`}
      style={{ animationDelay: `${index * 25}ms` }}
    >
      {/* Checkbox */}
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

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${task.completed ? 'line-through text-muted' : 'text-white/90'}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-[10px] text-muted mt-0.5 truncate">{task.description}</p>
        )}
      </div>

      {/* Priority badge */}
      {!task.completed && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${
          task.priority === 1 ? 'bg-accent-red/10 text-accent-red' :
          task.priority === 2 ? 'bg-accent-amber/10 text-accent-amber' :
          'bg-surface-3 text-muted'
        }`}>
          {task.priority === 1 ? 'High' : task.priority === 2 ? 'Med' : 'Low'}
        </span>
      )}
    </div>
  )
}
