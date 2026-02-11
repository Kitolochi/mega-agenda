import { useState } from 'react'
import { Task } from '../types'

interface TaskItemProps {
  task: Task
  compact?: boolean
  onToggle: () => void
  onDelete?: () => void
}

const priorityColors = { 1: 'border-accent-red', 2: 'border-accent-amber', 3: 'border-subtle' }
const priorityLabels = { 1: 'High', 2: 'Med', 3: 'Low' }
const recurrenceLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

export default function TaskItem({ task, compact, onToggle, onDelete }: TaskItemProps) {
  const [animating, setAnimating] = useState(false)

  const handleToggle = () => {
    if (!task.completed) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 500)
    }
    onToggle()
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 py-1 px-1.5 rounded-lg transition-all duration-300 ${
          task.completed ? 'opacity-40' : ''
        } ${animating ? 'bg-accent-emerald/10 scale-[0.97]' : ''} ${
          !task.completed && task.priority === 1 ? 'bg-accent-red/[0.04]' : 'hover:bg-white/[0.02]'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle() }}
          className={`w-3.5 h-3.5 rounded-[4px] border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
            task.completed ? 'bg-accent-emerald border-accent-emerald' : priorityColors[task.priority as 1|2|3]
          } ${animating ? 'scale-125' : 'hover:scale-110'}`}
        >
          {task.completed && (
            <svg className={`w-2 h-2 text-white ${animating ? 'animate-check-pop' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`text-[11px] truncate flex-1 ${task.completed ? 'line-through text-muted' : 'text-white/80'}`}>
          {task.title}
        </span>
        {task.is_recurring && task.recurrence_type && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-accent-blue/10 text-accent-blue">
            {recurrenceLabels[task.recurrence_type]}
          </span>
        )}
        {task.due_date && !task.completed && (
          <span className={`text-[10px] ${isOverdue ? 'text-accent-red' : 'text-muted'}`}>
            {formatDate(task.due_date)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`glass-card flex items-start gap-3 p-3 rounded-xl transition-all duration-300 ${
        task.completed ? 'opacity-50' : task.priority === 1 ? 'border-accent-red/20' : ''
      } ${animating ? 'scale-[0.98] border-accent-emerald/30 bg-accent-emerald/5' : ''}`}
      style={!task.completed && task.priority === 1 ? {
        boxShadow: 'inset 0 0 0 1px rgba(248, 113, 113, 0.08), 0 0 12px -6px rgba(248, 113, 113, 0.15)'
      } : undefined}
    >
      <button
        onClick={handleToggle}
        className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex-shrink-0 flex items-center justify-center mt-0.5 transition-all duration-200 ${
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
        {task.description && (
          <p className="text-[11px] text-muted mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          {!task.completed && (
            <span className={`text-[10px] px-1.5 py-[1px] rounded-md font-medium ${
              task.priority === 1 ? 'bg-accent-red/10 text-accent-red' :
              task.priority === 2 ? 'bg-accent-amber/10 text-accent-amber' :
              'bg-surface-3 text-muted'
            }`}>
              {priorityLabels[task.priority as 1|2|3]}
            </span>
          )}
          {task.is_recurring && task.recurrence_type && (
            <span className="text-[10px] px-1.5 py-[1px] rounded-md bg-accent-blue/10 text-accent-blue font-medium">
              {recurrenceLabels[task.recurrence_type]}
            </span>
          )}
          {task.due_date && (
            <span className={`text-[10px] ${isOverdue ? 'text-accent-red font-medium' : 'text-muted'}`}>
              {isOverdue && '! '}{formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {onDelete && (
        <button
          onClick={onDelete}
          className="text-muted/40 hover:text-accent-red p-1 rounded-lg hover:bg-accent-red/10 transition-all opacity-0 group-hover:opacity-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  )
}
