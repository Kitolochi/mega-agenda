import { ipcMain, BrowserWindow } from 'electron'
import { getCategories, addCategory, deleteCategory, getTasks, addTask, updateTask, deleteTask, toggleTaskComplete, getStats, getActivityLog } from '../database'

export function registerTaskHandlers(_mainWindow: BrowserWindow) {
  ipcMain.handle('get-categories', () => {
    return getCategories()
  })

  ipcMain.handle('add-category', (_, name: string, color: string, icon: string) => {
    return addCategory(name, color, icon)
  })

  ipcMain.handle('delete-category', (_, id: number) => {
    return deleteCategory(id)
  })

  ipcMain.handle('get-tasks', (_, categoryId?: number) => {
    return getTasks(categoryId)
  })

  ipcMain.handle('add-task', (_, task) => {
    return addTask(task)
  })

  ipcMain.handle('update-task', (_, id: number, updates) => {
    return updateTask(id, updates)
  })

  ipcMain.handle('delete-task', (_, id: number) => {
    return deleteTask(id)
  })

  ipcMain.handle('toggle-task', (_, id: number) => {
    return toggleTaskComplete(id)
  })

  ipcMain.handle('get-stats', () => {
    return getStats()
  })

  ipcMain.handle('get-activity-log', (_, days?: number) => {
    return getActivityLog(days)
  })
}
