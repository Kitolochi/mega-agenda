import { useState } from 'react'
import { Category, Task } from '../types'

interface AddTaskModalProps {
  categories: Category[]
  defaultCategoryId?: number
  onAdd: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'last_completed'>) => void
  onClose: () => void
}

export default function AddTaskModal({ categories, defaultCategoryId, onAdd, onClose }: AddTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || 1)
  const [priority, setPriority] = useState(2)
  const [dueDate, setDueDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      category_id: categoryId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      due_date: dueDate || undefined,
      completed: 0,
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType : undefined,
      recurrence_interval: isRecurring ? recurrenceInterval : undefined
    })
  }

  const getRecurrenceLabel = () => {
    if (recurrenceInterval === 1) {
      return recurrenceType === 'daily' ? 'Every day' :
             recurrenceType === 'weekly' ? 'Every week' : 'Every month'
    }
    return `Every ${recurrenceInterval} ${recurrenceType === 'daily' ? 'days' :
            recurrenceType === 'weekly' ? 'weeks' : 'months'}`
  }

  const inputClass = "w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 focus:bg-surface-3 transition-all placeholder-muted/50"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-card rounded-2xl w-full max-w-sm shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
          <h2 className="font-display font-semibold text-sm text-white/90">New Task</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-1.5">Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={inputClass}>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-1.5">Title</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?" autoFocus className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-1.5">Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Details (optional)" rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-1.5">Priority</label>
              <div className="flex gap-1">
                {[
                  { val: 1, label: 'High', color: 'accent-red' },
                  { val: 2, label: 'Med', color: 'accent-amber' },
                  { val: 3, label: 'Low', color: 'muted' },
                ].map(p => (
                  <button
                    key={p.val} type="button"
                    onClick={() => setPriority(p.val)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      priority === p.val
                        ? p.val === 1 ? 'bg-accent-red/15 text-accent-red border border-accent-red/20'
                        : p.val === 2 ? 'bg-accent-amber/15 text-accent-amber border border-accent-amber/20'
                        : 'bg-surface-4 text-white/70 border border-white/10'
                        : 'bg-surface-2 text-muted border border-transparent hover:bg-surface-3'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Recurring Toggle */}
          <div className="border-t border-white/[0.04] pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-8 h-[18px] rounded-full transition-all duration-200 relative ${
                  isRecurring ? 'bg-accent-blue' : 'bg-surface-4'
                }`}
                onClick={() => setIsRecurring(!isRecurring)}
              >
                <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                  isRecurring ? 'left-[16px]' : 'left-[2px]'
                }`} />
              </div>
              <span className="text-xs text-white/80">Recurring</span>
              {isRecurring && (
                <span className="text-[10px] text-accent-blue ml-auto">{getRecurrenceLabel()}</span>
              )}
            </label>
          </div>

          {/* Recurrence Options */}
          {isRecurring && (
            <div className="bg-surface-2/50 rounded-xl p-3.5 space-y-3 border border-white/[0.03] animate-slide-up">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted mb-1">Every</label>
                  <input
                    type="number" min="1" max="99" value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">Period</label>
                  <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as any)} className={inputClass}>
                    <option value="daily">Day(s)</option>
                    <option value="weekly">Week(s)</option>
                    <option value="monthly">Month(s)</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-muted/60">Auto-resets after completion</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-surface-3 hover:bg-surface-4 rounded-xl text-xs font-medium text-white/60 hover:text-white/80 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={!title.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-semibold text-white transition-all shadow-lg shadow-accent-blue/10"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
