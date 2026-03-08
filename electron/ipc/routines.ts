import { ipcMain, BrowserWindow } from 'electron'
import {
  getRoutines,
  getRoutine,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineResults,
  getRoutineResultsForDate,
  deleteRoutineResult,
} from '../database'
import { executeRoutine, notifyRoutineResult } from '../routines'

export function registerRoutineHandlers(_mainWindow: BrowserWindow) {
  ipcMain.handle('get-routines', () => {
    return getRoutines()
  })

  ipcMain.handle('get-routine', (_, id: string) => {
    return getRoutine(id)
  })

  ipcMain.handle('create-routine', (_, data) => {
    return createRoutine(data)
  })

  ipcMain.handle('update-routine', (_, id: string, updates) => {
    return updateRoutine(id, updates)
  })

  ipcMain.handle('delete-routine', (_, id: string) => {
    return deleteRoutine(id)
  })

  ipcMain.handle('run-routine', async (_, id: string) => {
    const routine = getRoutine(id)
    if (!routine) return null
    const result = await executeRoutine(routine)
    notifyRoutineResult(routine, result)
    _mainWindow?.webContents.send('routines-updated')
    return result
  })

  ipcMain.handle('get-routine-results', (_, routineId?: string, date?: string, limit?: number) => {
    return getRoutineResults(routineId, date, limit)
  })

  ipcMain.handle('get-routine-results-for-date', (_, date: string) => {
    return getRoutineResultsForDate(date)
  })

  ipcMain.handle('delete-routine-result', (_, id: string) => {
    return deleteRoutineResult(id)
  })
}
