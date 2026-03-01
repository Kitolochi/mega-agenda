import { create } from 'zustand'
import { Task, Category, Stats } from '../types'

interface TaskState {
  categories: Category[]
  tasks: Task[]
  stats: Stats | null
  loading: boolean

  loadData: () => Promise<void>
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'last_completed'>) => Promise<void>
  toggleTask: (id: number) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  addCategory: (name: string, color: string, icon: string) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  categories: [],
  tasks: [],
  stats: null,
  loading: false,

  loadData: async () => {
    set({ loading: true })
    try {
      const [cats, allTasks, statsData] = await Promise.all([
        window.electronAPI.getCategories(),
        window.electronAPI.getTasks(),
        window.electronAPI.getStats()
      ])
      set({ categories: cats, tasks: allTasks, stats: statsData })
    } finally {
      set({ loading: false })
    }
  },

  addTask: async (task) => {
    await window.electronAPI.addTask(task)
    await get().loadData()
  },

  toggleTask: async (id) => {
    await window.electronAPI.toggleTask(id)
    await get().loadData()
  },

  deleteTask: async (id) => {
    await window.electronAPI.deleteTask(id)
    await get().loadData()
  },

  addCategory: async (name, color, icon) => {
    const cat = await window.electronAPI.addCategory(name, color, icon)
    await get().loadData()
    return cat
  },

  deleteCategory: async (id) => {
    await window.electronAPI.deleteCategory(id)
    await get().loadData()
  },
}))
