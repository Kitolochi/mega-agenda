import { app, BrowserWindow, Tray, Menu, nativeImage, session } from 'electron'
import path from 'path'
import { initDatabase, checkRecurringTasks } from './database'
import { initEmbeddingModel, getEmbeddingStatus } from './embeddings'
import { startHealthMonitor } from './memory-health'
import { initWhisperModel } from './whisper'
import { loadVectorIndex, rebuildIndex } from './vector-store'
import { registerAllHandlers } from './ipc'
import { syncAllGoalContextFiles } from './ipc/ai'
import { scaffoldDomainFolders } from './ipc/system'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// --- Cross-platform terminal launcher helper ---
function launchInExternalTerminal(opts: {
  prompt: string
  cwd: string
  env: NodeJS.ProcessEnv
  title?: string
  allowedTools?: string
}): void {
  const tmpDir = path.join(app.getPath('temp'), 'mega-agenda')
  fs.mkdirSync(tmpDir, { recursive: true })
  const safePrompt = opts.prompt.replace(/%/g, '%%').replace(/"/g, "'")
  const tools = opts.allowedTools || '"Bash(*)" "Edit(*)" "Write(*)" "Read(*)" "Glob(*)" "Grep(*)" "WebFetch(*)" "WebSearch(*)"'
  const claudeCmd = `npx --yes @anthropic-ai/claude-code --dangerously-skip-permissions --allowedTools ${tools} -- "${safePrompt}"`

  if (process.platform === 'win32') {
    const batFile = path.join(tmpDir, `launch-${Date.now()}.bat`)
    fs.writeFileSync(batFile, [
      '@echo off',
      `cd /d "${opts.cwd}"`,
      claudeCmd,
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', 'start', `"${(opts.title || '').slice(0, 40)}"`, 'cmd', '/k', batFile], {
      detached: true, stdio: 'ignore', env: opts.env,
    })
    child.unref()
  } else {
    const shFile = path.join(tmpDir, `launch-${Date.now()}.sh`)
    fs.writeFileSync(shFile, [
      '#!/bin/bash',
      `cd "${opts.cwd}"`,
      claudeCmd,
      'exec $SHELL',
    ].join('\n'))
    fs.chmodSync(shFile, 0o755)
    if (process.platform === 'darwin') {
      const child = spawn('open', ['-a', 'Terminal', shFile], {
        detached: true, stdio: 'ignore', env: opts.env,
      })
      child.unref()
    } else {
      const child = spawn('x-terminal-emulator', ['-e', shFile], {
        detached: true, stdio: 'ignore', env: opts.env,
      })
      child.unref()
    }
  }
}

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Ensure mediaDevices API is available (requires secure context)
if (VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', VITE_DEV_SERVER_URL)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#0c0c0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show the window once the page is ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // No auto-hide on blur -- app shows in taskbar normally

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow?.hide()
  })
}

function createTray() {
  // Destroy previous tray if it exists (prevents duplicate tray icons on hot-reload)
  if (tray) {
    tray.destroy()
    tray = null
  }

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

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Enforce single instance — quit if another is already running
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.center()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // Auto-grant microphone permission for voice commands
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'clipboard-read', 'notifications'].includes(permission))
  })

  initDatabase()
  createWindow()
  createTray()

  // Register all IPC handlers from modular files
  registerAllHandlers(mainWindow!)

  // Check recurring tasks every 60s; notify renderer to re-fetch if any were reset
  setInterval(() => {
    if (checkRecurringTasks()) {
      mainWindow?.webContents.send('tasks-updated')
    }
  }, 60 * 1000)

  // Sync goal context files on startup
  syncAllGoalContextFiles()

  // Scaffold domain-based memory folders
  scaffoldDomainFolders()

  // Start memory health monitor (check every 5 minutes, send updates on status change)
  startHealthMonitor(5 * 60 * 1000, (health) => {
    mainWindow?.webContents.send('memory-health-update', health)
  })

  // Background: pre-warm embedding + whisper models after 5s, then refresh vector index
  setTimeout(async () => {
    try {
      // Load embedding and whisper models in parallel
      const embeddingReady = initEmbeddingModel((progress) => {
        mainWindow?.webContents.send('embedding-progress', progress)
      })
      initWhisperModel().catch(err => {
        console.error('Whisper model init failed:', err)
      })
      await embeddingReady
      // Load or build vector index once model is ready
      const embStatus = getEmbeddingStatus()
      if (embStatus.ready) {
        const existing = loadVectorIndex()
        // Always do an incremental refresh to pick up changes
        await rebuildIndex((info) => {
          mainWindow?.webContents.send('index-progress', info)
        })
      }
    } catch (err) {
      console.error('Background embedding/index init failed:', err)
    }
  }, 5000)

  // Check once per hour if a new day has started; if so, re-sync goal context files
  let lastSyncDate = new Date().toISOString().split('T')[0]
  setInterval(() => {
    const today = new Date().toISOString().split('T')[0]
    if (today !== lastSyncDate) {
      lastSyncDate = today
      console.log('New day detected — syncing goal context files')
      syncAllGoalContextFiles()
    }
  }, 60 * 60 * 1000)
})

app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
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
