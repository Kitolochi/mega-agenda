import { ipcMain } from 'electron'
import http from 'http'

const AV_BASE = 'http://127.0.0.1:8090/api/v1'

function avFetch(path: string, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${AV_BASE}/${path}`)
    const req = http.get(url, { timeout }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Invalid JSON from AgentsView: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('AgentsView request timed out')) })
  })
}

export function registerAgentsViewHandlers() {
  ipcMain.handle('av-ping', async () => {
    try {
      await avFetch('stats', 3000)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('av-get-stats', () => avFetch('stats'))
  ipcMain.handle('av-get-summary', () => avFetch('analytics/summary'))
  ipcMain.handle('av-get-tools', () => avFetch('analytics/tools'))
  ipcMain.handle('av-get-velocity', () => avFetch('analytics/velocity'))
  ipcMain.handle('av-get-heatmap', () => avFetch('analytics/heatmap'))
  ipcMain.handle('av-get-projects', () => avFetch('analytics/projects'))
  ipcMain.handle('av-get-sessions', () => avFetch('analytics/sessions'))
  ipcMain.handle('av-get-top-sessions', () => avFetch('analytics/top-sessions'))
  ipcMain.handle('av-get-session-list', (_, limit?: number) =>
    avFetch(`sessions?limit=${limit ?? 50}&sort=updated_at&order=desc`))
  ipcMain.handle('av-get-insights', () => avFetch('insights'))
  ipcMain.handle('av-get-sync-status', () => avFetch('sync/status'))
}
