import { ipcMain, BrowserWindow, Notification } from 'electron'
import {
  getCalendarEvents,
  getDailyAgenda,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  upsertGcalEvent,
  getLastDailyNotifDate,
  setLastDailyNotifDate,
} from '../database'
import { gwsCheckAuth, gwsExec } from '../gws-bridge'

export function registerCalendarHandlers(_mainWindow: BrowserWindow) {
  ipcMain.handle('get-calendar-events', (_, startDate: string, endDate: string) => {
    return getCalendarEvents(startDate, endDate)
  })

  ipcMain.handle('get-daily-agenda', (_, date: string) => {
    return getDailyAgenda(date)
  })

  ipcMain.handle('create-calendar-event', (_, data) => {
    return createCalendarEvent(data)
  })

  ipcMain.handle('update-calendar-event', (_, id: string, updates) => {
    return updateCalendarEvent(id, updates)
  })

  ipcMain.handle('delete-calendar-event', (_, id: string) => {
    return deleteCalendarEvent(id)
  })

  ipcMain.handle('sync-gcal-events', async () => {
    const auth = await gwsCheckAuth()
    if (!auth.installed || !auth.authenticated) {
      return { success: false, error: auth.error || 'gws not available' }
    }

    try {
      const now = new Date()
      const timeMin = now.toISOString()
      const futureDate = new Date(now)
      futureDate.setDate(futureDate.getDate() + 7)
      const timeMax = futureDate.toISOString()

      const result = await gwsExec('calendar', 'events', 'list', {
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      })

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to fetch calendar events' }
      }

      const items = result.data.items || result.data || []
      let synced = 0

      for (const item of items) {
        if (!item.id) continue
        const startDate = item.start?.date || (item.start?.dateTime ? item.start.dateTime.split('T')[0] : '')
        const startTime = item.start?.dateTime ? item.start.dateTime.split('T')[1]?.substring(0, 5) : ''
        const endTime = item.end?.dateTime ? item.end.dateTime.split('T')[1]?.substring(0, 5) : ''

        if (!startDate) continue

        upsertGcalEvent(item.id, {
          title: item.summary || '(No title)',
          description: item.description || '',
          date: startDate,
          startTime: startTime || '',
          endTime: endTime || '',
          color: 'purple',
        })
        synced++
      }

      return { success: true, synced }
    } catch (err: any) {
      return { success: false, error: err.message || 'Sync failed' }
    }
  })

  ipcMain.handle('fire-daily-notification', () => {
    return fireDailyNotification()
  })
}

export function fireDailyNotification(): string | null {
  const today = new Date().toISOString().split('T')[0]
  const lastDate = getLastDailyNotifDate()
  if (lastDate === today) return null

  const agenda = getDailyAgenda(today)
  const taskCount = agenda.tasks.length
  const eventCount = agenda.events.length

  if (taskCount === 0 && eventCount === 0) {
    setLastDailyNotifDate(today)
    return null
  }

  const lines: string[] = []
  if (taskCount > 0) lines.push(`${taskCount} task${taskCount > 1 ? 's' : ''} due`)
  if (eventCount > 0) lines.push(`${eventCount} event${eventCount > 1 ? 's' : ''}`)

  const topItems = [
    ...agenda.tasks.slice(0, 2).map(t => t.title),
    ...agenda.events.slice(0, 1).map(e => e.title),
  ]
  if (topItems.length) lines.push(topItems.join(', '))

  const body = lines.join(' · ')
  new Notification({ title: "Today's Agenda", body }).show()
  setLastDailyNotifDate(today)
  return body
}
