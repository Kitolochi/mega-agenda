import { Category, Task } from '../types'
import TaskItem from './TaskItem'
import { playClick } from '../utils/sounds'

interface CategoryCardProps {
  category: Category
  tasks: Task[]
  onClick: () => void
  onToggleTask: (id: number) => void
  onAddTask: () => void
}

export default function CategoryCard({
  category, tasks, onClick, onToggleTask, onAddTask
}: CategoryCardProps) {
  const displayTasks = tasks.slice(0, 3)
  const hasMore = tasks.length > 3
  const completedCount = tasks.filter(t => t.completed).length
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <div
      className="glass-card rounded-xl overflow-hidden cursor-pointer hover-lift group"
    >
      {/* Accent line — animated gradient */}
      <div
        className="h-[2px] transition-all duration-500 group-hover:h-[3px]"
        style={{ background: `linear-gradient(90deg, ${category.color}, ${category.color}40, transparent)` }}
      />

      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between" onClick={() => { onClick(); playClick() }}>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-transform duration-200 group-hover:scale-110"
            style={{ backgroundColor: category.color + '15' }}
          >
            {category.icon}
          </div>
          <div>
            <span className="font-display font-semibold text-xs text-white/90 block leading-tight">{category.name}</span>
            <span className="text-[10px] text-muted">{completedCount}/{tasks.length}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAddTask(); playClick() }}
          className="w-6 h-6 rounded-lg bg-surface-3/70 hover:bg-surface-4 flex items-center justify-center text-muted hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
        >
          +
        </button>
      </div>

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="px-3 pb-1.5">
          <div className="h-[3px] bg-white/[0.03] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${category.color}, ${category.color}CC)`,
                boxShadow: progress > 0 ? `0 0 8px ${category.color}30` : 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Tasks Preview */}
      <div className="px-2 pb-2 space-y-0.5">
        {displayTasks.length === 0 ? (
          <p className="text-[11px] text-muted/50 italic py-2 px-1">No tasks yet</p>
        ) : (
          <>
            {displayTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                compact
                onToggle={() => onToggleTask(task.id)}
              />
            ))}
            {hasMore && (
              <button
                onClick={onClick}
                className="text-[10px] text-muted hover:text-white/60 py-0.5 px-1 transition-colors"
              >
                +{tasks.length - 3} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
