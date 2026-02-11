import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell } from 'electron'
import path from 'path'
import { initDatabase, getCategories, getTasks, addTask, updateTask, deleteTask, toggleTaskComplete, getDailyNote, saveDailyNote, getRecentNotes, getStats, getTwitterSettings, saveTwitterSettings, getRSSFeeds, addRSSFeed, removeRSSFeed, getClaudeApiKey, saveClaudeApiKey } from './database'
import { verifyToken, getUserByUsername, getUserLists, fetchAllLists } from './twitter'
import { fetchAllFeeds } from './rss'
import { summarizeAI, summarizeGeo, verifyClaudeKey, parseVoiceCommand } from './summarize'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // Don't auto-open DevTools
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide()
    }
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })
}

function createTray() {
  // Load icon from file - works better on Windows
  const iconPath = path.join(app.getAppPath(), 'public', 'tray-icon.png')
  let trayIcon = nativeImage.createFromPath(iconPath)

  // Fallback to embedded if file not found
  if (trayIcon.isEmpty()) {
    const icon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2NkoBAwUqifgWoGjBowasCoAQNvwFAIAwDkfQER39Vg/AAAAABJRU5ErkJggg=='
    trayIcon = nativeImage.createFromDataURL(`data:image/png;base64,${icon16Base64}`)
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Mega Agenda')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => showWindow()
    },
    {
      label: 'Quick Add Task',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('open-add-modal')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow?.destroy()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showWindow()
  })
}

function showWindow() {
  if (!mainWindow) return

  const trayBounds = tray?.getBounds()
  if (trayBounds) {
    const windowBounds = mainWindow.getBounds()
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
    const y = Math.round(trayBounds.y - windowBounds.height - 10)
    mainWindow.setPosition(x, y, false)
  }

  mainWindow.show()
  mainWindow.focus()
}

// Task IPC Handlers
ipcMain.handle('get-categories', () => {
  return getCategories()
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

// Notes IPC Handlers
ipcMain.handle('get-daily-note', (_, date: string) => {
  return getDailyNote(date)
})

ipcMain.handle('save-daily-note', (_, date: string, content: string) => {
  return saveDailyNote(date, content)
})

ipcMain.handle('get-recent-notes', (_, limit?: number) => {
  return getRecentNotes(limit)
})

// Stats handler
ipcMain.handle('get-stats', () => {
  return getStats()
})

// Twitter handlers
ipcMain.handle('get-twitter-settings', () => {
  return getTwitterSettings()
})

ipcMain.handle('save-twitter-settings', (_, settings) => {
  return saveTwitterSettings(settings)
})

ipcMain.handle('verify-twitter-token', async (_, bearerToken: string) => {
  return verifyToken(bearerToken)
})

ipcMain.handle('twitter-get-user', async (_, bearerToken: string, username: string) => {
  return getUserByUsername(bearerToken, username)
})

ipcMain.handle('twitter-get-lists', async (_, bearerToken: string, userId: string) => {
  return getUserLists(bearerToken, userId)
})

ipcMain.handle('twitter-fetch-feed', async (_, bearerToken: string, lists: { id: string; name: string }[]) => {
  return fetchAllLists(bearerToken, lists)
})

// RSS handlers
ipcMain.handle('get-rss-feeds', () => {
  return getRSSFeeds()
})

ipcMain.handle('add-rss-feed', (_, url: string, name: string, category: string) => {
  return addRSSFeed({ url, name, category: category || 'ai' })
})

ipcMain.handle('remove-rss-feed', (_, url: string) => {
  return removeRSSFeed(url)
})

ipcMain.handle('fetch-rss-feeds', async (_, feeds: { url: string; name: string; category: string }[]) => {
  return fetchAllFeeds(feeds)
})

// Claude API
ipcMain.handle('get-claude-api-key', () => {
  return getClaudeApiKey()
})

ipcMain.handle('save-claude-api-key', (_, key: string) => {
  saveClaudeApiKey(key)
  return true
})

ipcMain.handle('verify-claude-key', async (_, key: string) => {
  return verifyClaudeKey(key)
})

ipcMain.handle('summarize-feed', async (_, apiKey: string, articles: { title: string; description: string }[], section: string) => {
  if (section === 'ai') return summarizeAI(apiKey, articles)
  if (section === 'geo') return summarizeGeo(apiKey, articles)
  return summarizeAI(apiKey, articles)
})

// Voice command parsing
ipcMain.handle('parse-voice-command', async (_, apiKey: string, transcript: string, categoryNames: string[]) => {
  return parseVoiceCommand(apiKey, transcript, categoryNames)
})

// Open URL in browser
ipcMain.handle('open-external', (_, url: string) => {
  return shell.openExternal(url)
})

// Window controls
ipcMain.on('close-window', () => {
  mainWindow?.hide()
})

ipcMain.on('minimize-window', () => {
  mainWindow?.hide()
})

app.whenReady().then(() => {
  initDatabase()
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
