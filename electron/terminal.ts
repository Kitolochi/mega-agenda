import { BrowserWindow, app } from 'electron'

let ptyProcess: any = null
let ptyPid: number | null = null

export function createTerminal(mainWindow: BrowserWindow, cols: number, rows: number) {
  // Kill existing terminal if any
  killTerminal()

  const pty = require('node-pty')

  // Clean env to avoid nested Claude Code session detection
  const env = { ...process.env }
  delete env.CLAUDE_CODE
  delete env.CLAUDECODE

  const shell = process.env.COMSPEC || 'cmd.exe'

  try {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.USERPROFILE || process.env.HOME || '.',
      env,
      useConpty: true,
      // useConptyDll avoids child_process.fork() on kill which crashes in Electron
      useConptyDll: true,
    })
    ptyPid = ptyProcess.pid
  } catch (err) {
    console.error('Failed to spawn PTY:', err)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-data', `\r\nError spawning terminal: ${err}\r\n`)
    }
    return
  }

  ptyProcess.onData((data: string) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-data', data)
      }
    } catch {}
  })

  ptyProcess.onExit(() => {
    ptyProcess = null
    ptyPid = null
  })

  // Auto-launch Claude Code CLI after a short delay
  setTimeout(() => {
    if (ptyProcess) {
      ptyProcess.write('claude\r')
    }
  }, 1000)
}

export function writeTerminal(data: string) {
  if (ptyProcess) {
    ptyProcess.write(data)
  }
}

export function resizeTerminal(cols: number, rows: number) {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows)
    } catch {}
  }
}

export function killTerminal() {
  if (ptyProcess) {
    try { ptyProcess.kill() } catch {}
    ptyProcess = null
    ptyPid = null
  }
}

// Clean up PTY when the app quits
app.on('before-quit', () => {
  killTerminal()
})
