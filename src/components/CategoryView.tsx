import { Category, Task } from '../types'
import TaskItem from './TaskItem'

interface CategoryViewProps {
  category: Category
  tasks: Task[]
  onBack: () => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onAddTask: () => void
}

export default function CategoryView({ category, tasks, onBack, onToggle, onDelete, onAddTask }: CategoryViewProps) {
  const pendingTasks = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center gap-3 border-b border-white/[0.04]">
        <button
          onClick={onBack}
          className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ backgroundColor: category.color + '15' }}
        >
          {category.icon}
        </div>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-sm text-white/90">{category.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-[3px] bg-white/[0.04] rounded-full overflow-hidden max-w-[80px]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: category.color }}
              />
            </div>
            <span className="text-[10px] text-muted">{completedTasks.length}/{tasks.length}</span>
          </div>
        </div>
        <button
          onClick={onAddTask}
          className="px-3 py-1.5 bg-surface-3 hover:bg-surface-4 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all"
        >
          + Add
        </button>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center text-xl"
              style={{ backgroundColor: category.color + '10' }}
            >
              {category.icon}
            </div>
            <p className="text-sm text-white/60 mb-1">No tasks yet</p>
            <p className="text-[11px] text-muted">Add your first task to get started</p>
          </div>
        ) : (
          <>
            {pendingTasks.map((task, i) => (
              <div key={task.id} className="group animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                <TaskItem
                  task={task}
                  onToggle={() => onToggle(task.id)}
                  onDelete={() => onDelete(task.id)}
                />
              </div>
            ))}

            {completedTasks.length > 0 && (
              <div className="pt-4">
                <p className="text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2 px-1">
                  Completed ({completedTasks.length})
                </p>
                <div className="space-y-1.5">
                  {completedTasks.map(task => (
                    <div key={task.id} className="group">
                      <TaskItem
                        task={task}
                        onToggle={() => onToggle(task.id)}
                        onDelete={() => onDelete(task.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
