# Command Center Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Command Center tab to mega-agenda that orchestrates multiple headless Claude Code CLI instances across projects via a focus queue UI.

**Architecture:** Electron main process spawns `claude -p` child processes with stream-json I/O. A Zustand store manages the ephemeral queue. IPC channels bridge main↔renderer. History persists in the existing JSON database.

**Tech Stack:** Electron 28 (child_process.spawn), React 18, TypeScript, Tailwind CSS, Zustand, existing UI primitives (Button, Input, Card, Dialog, Badge, EmptyState)

**Spec:** `docs/superpowers/specs/2026-03-11-command-center-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `electron/command-center.ts` | Process manager: spawn, message parsing, stdin writes, lifecycle, graceful shutdown |
| `electron/ipc/command-center.ts` | IPC handlers bridging renderer calls to process manager |
| `electron/database.ts` | Add `commandCenterHistory` and `knownProjects` to Database interface + migration |
| `electron/preload.ts` | Expose `cc*` methods on `window.electronAPI` |
| `electron/main.ts` | Register handlers, wire graceful shutdown on `before-quit` |
| `src/store/commandCenterStore.ts` | Zustand store: queue, history, actions |
| `src/store/index.ts` | Re-export new store |
| `src/store/appStore.ts` | Add `command-center` tab to Tab type and TAB_GROUPS |
| `src/components/layout/ContentArea.tsx` | Route `command-center` tab |
| `src/components/command-center/CommandCenter.tsx` | Root component: header, Queue/History toggle, status bar |
| `src/components/command-center/FocusCard.tsx` | Dominant card: result text, expand toggles, response input, Done button |
| `src/components/command-center/CollapsedCard.tsx` | Collapsed queue item: project badge, status, one-liner |
| `src/components/command-center/LaunchCard.tsx` | Modal: project picker, prompt textarea, model/budget, launch |
| `src/components/command-center/HistoryView.tsx` | Session history list with project filter |
| `src/components/command-center/ConfettiOverlay.tsx` | Canvas-based confetti burst animation |
| `src/types/index.ts` | Add Command Center types to ElectronAPI |

---

## Chunk 1: Backend — Process Manager + Database

### Task 1: Database Schema Migration

**Files:**
- Modify: `electron/database.ts:578-601` (Database interface)
- Modify: `electron/database.ts:633-660` (initDatabase migration)

- [ ] **Step 1: Add interfaces to Database type**

In `electron/database.ts`, add after `agentEvents: AgentEvent[]` (line 600):

```typescript
// Command Center
commandCenterHistory: CCHistoryEntry[]
knownProjects: KnownProject[]
```

Add the interface definitions before the `Database` interface (around line 560):

```typescript
interface CCHistoryEntry {
  id: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  summary: string
  filesChanged: string[]
  costUsd: number
  turnCount: number
  startedAt: number
  completedAt: number
}

interface KnownProject {
  path: string
  name: string
  lastUsed: number
}
```

- [ ] **Step 2: Add migration in initDatabase**

In `initDatabase()`, after the existing migrations (around line 659), add:

```typescript
if (!db.commandCenterHistory) db.commandCenterHistory = []
if (!db.knownProjects) db.knownProjects = []
```

- [ ] **Step 3: Add CRUD helper functions**

After the existing agent functions in `database.ts`, add:

```typescript
// Command Center History
export function addCCHistoryEntry(entry: CCHistoryEntry): CCHistoryEntry {
  db.commandCenterHistory.push(entry)
  saveDatabase()
  return entry
}

export function getCCHistory(filter?: string, limit = 100): CCHistoryEntry[] {
  let entries = db.commandCenterHistory
  if (filter) entries = entries.filter(e => e.projectPath === filter)
  return entries.sort((a, b) => b.completedAt - a.completedAt).slice(0, limit)
}

// Known Projects
export function getKnownProjects(): KnownProject[] {
  return db.knownProjects.sort((a, b) => b.lastUsed - a.lastUsed)
}

export function upsertKnownProject(projectPath: string): KnownProject {
  const name = path.basename(projectPath)
  const existing = db.knownProjects.find(p => p.path === projectPath)
  if (existing) {
    existing.lastUsed = Date.now()
    existing.name = name
  } else {
    db.knownProjects.push({ path: projectPath, name, lastUsed: Date.now() })
  }
  saveDatabase()
  return db.knownProjects.find(p => p.path === projectPath)!
}

export function discoverProjects(): KnownProject[] {
  const claudeProjectsDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'projects')
  if (!fs.existsSync(claudeProjectsDir)) return db.knownProjects
  const dirs = fs.readdirSync(claudeProjectsDir)
  for (const dir of dirs) {
    const claudeMd = path.join(claudeProjectsDir, dir, 'CLAUDE.md')
    if (fs.existsSync(claudeMd)) {
      const projectPath = dir.split('--').join(path.sep)
      if (!db.knownProjects.find(p => p.path === projectPath)) {
        db.knownProjects.push({ path: projectPath, name: path.basename(projectPath), lastUsed: 0 })
      }
    }
  }
  saveDatabase()
  return db.knownProjects
}
```

- [ ] **Step 4: Export new functions**

Ensure all new functions are exported from `database.ts`. Verify no TypeScript errors:

Run: `cd "C:/Users/chris/mega-agenda" && npx tsc --noEmit 2>&1 | grep -i "command\|CCHistory\|KnownProject" | head -20`

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add electron/database.ts
git commit -m "feat(command-center): add database schema and CRUD for history + known projects"
```

---

### Task 2: Process Manager

**Files:**
- Create: `electron/command-center.ts`

- [ ] **Step 1: Create the process manager module**

```typescript
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import { BrowserWindow } from 'electron'

// --- Types ---

export interface CCQueueItem {
  processId: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  status: 'working' | 'awaiting_input' | 'errored'
  resultText?: string
  errorMessage?: string
  filesChanged: string[]
  fullLog: CCStreamMessage[]
  costUsd: number
  turnCount: number
  startedAt: number
  updatedAt: number
}

export interface CCStreamMessage {
  type: string
  subtype?: string
  text?: string
  toolName?: string
  toolInput?: string
  timestamp: number
}

interface ManagedProcess {
  proc: ChildProcess
  item: CCQueueItem
  buffer: string
}

// --- Constants ---

const ACCENT_COLORS = ['blue', 'purple', 'red', 'cyan', 'green', 'orange', 'amber', 'pink']
const MAX_PROCESSES = 10

// --- State ---

const processes = new Map<string, ManagedProcess>()
let mainWindow: BrowserWindow | null = null

// --- Helpers ---

function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length]
}

function notifyRenderer() {
  mainWindow?.webContents.send('cc:queue-update', getQueue())
}

// --- Public API ---

export function initCommandCenter(win: BrowserWindow) {
  mainWindow = win
}

export function getQueue(): CCQueueItem[] {
  return Array.from(processes.values()).map(m => ({ ...m.item }))
}

export function getProcessCount(): number {
  return processes.size
}

export function launchProcess(opts: {
  projectPath: string
  prompt: string
  model?: string
  maxBudget?: number
}): CCQueueItem {
  if (processes.size >= MAX_PROCESSES) {
    throw new Error('Max concurrent tasks reached (10)')
  }

  const processId = crypto.randomUUID()
  const projectName = path.basename(opts.projectPath)
  const projectColor = hashColor(opts.projectPath)

  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--no-session-persistence',
  ]
  if (opts.model) args.push('--model', opts.model)
  if (opts.maxBudget) args.push('--max-budget-usd', String(opts.maxBudget))

  const proc = spawn('claude', args, {
    cwd: opts.projectPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  })

  const item: CCQueueItem = {
    processId,
    projectPath: opts.projectPath,
    projectName,
    projectColor,
    prompt: opts.prompt,
    status: 'working',
    filesChanged: [],
    fullLog: [],
    costUsd: 0,
    turnCount: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  }

  const managed: ManagedProcess = { proc, item, buffer: '' }
  processes.set(processId, managed)

  // Send initial prompt
  const msg = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: opts.prompt }
  }) + '\n'
  proc.stdin?.write(msg)

  // Handle stdout (stream-json, newline-delimited)
  proc.stdout?.on('data', (data: Buffer) => {
    managed.buffer += data.toString()
    const lines = managed.buffer.split('\n')
    managed.buffer = lines.pop() || '' // keep incomplete line in buffer
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        handleMessage(processId, parsed)
      } catch {
        // skip unparseable lines
      }
    }
  })

  // Handle stderr
  let stderrBuf = ''
  proc.stderr?.on('data', (data: Buffer) => {
    stderrBuf += data.toString()
    // Keep last 2000 chars
    if (stderrBuf.length > 2000) stderrBuf = stderrBuf.slice(-2000)
  })

  // Handle exit
  proc.on('close', (code) => {
    const m = processes.get(processId)
    if (!m) return
    if (m.item.status === 'working') {
      // Unexpected exit
      m.item.status = 'errored'
      m.item.errorMessage = `Process exited with code ${code}. ${stderrBuf.slice(-500)}`
      m.item.updatedAt = Date.now()
      notifyRenderer()
    }
  })

  proc.on('error', (err) => {
    const m = processes.get(processId)
    if (!m) return
    m.item.status = 'errored'
    m.item.errorMessage = err.message
    m.item.updatedAt = Date.now()
    notifyRenderer()
  })

  notifyRenderer()
  return item
}

function handleMessage(processId: string, msg: any) {
  const m = processes.get(processId)
  if (!m) return

  const { item } = m
  const timestamp = Date.now()

  if (msg.type === 'assistant' && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === 'text') {
        item.fullLog.push({ type: 'assistant', text: block.text, timestamp })
        item.resultText = block.text // latest text
      } else if (block.type === 'tool_use') {
        item.fullLog.push({
          type: 'tool_use',
          toolName: block.name,
          toolInput: JSON.stringify(block.input || {}).slice(0, 200),
          timestamp,
        })
        // Track file changes
        if ((block.name === 'Edit' || block.name === 'Write') && block.input?.file_path) {
          const fp = block.input.file_path
          if (!item.filesChanged.includes(fp)) item.filesChanged.push(fp)
        }
      }
    }
    item.updatedAt = timestamp
    notifyRenderer()
  } else if (msg.type === 'result') {
    item.turnCount++
    if (msg.total_cost_usd != null) item.costUsd = msg.total_cost_usd
    if (msg.result) item.resultText = msg.result

    if (msg.subtype === 'error' || msg.is_error) {
      item.status = 'errored'
      item.errorMessage = msg.result || 'Unknown error'
    } else {
      item.status = 'awaiting_input'
    }
    item.updatedAt = timestamp
    notifyRenderer()
  }
  // Ignore system messages (init, hook_started, hook_response)
}

export function respondToProcess(processId: string, response: string) {
  const m = processes.get(processId)
  if (!m) throw new Error(`Process ${processId} not found`)
  if (!m.proc.stdin?.writable) {
    m.item.status = 'errored'
    m.item.errorMessage = 'Process stdin is closed (EPIPE)'
    m.item.updatedAt = Date.now()
    notifyRenderer()
    throw new Error('Process stdin closed')
  }

  const msg = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: response }
  }) + '\n'

  m.item.fullLog.push({ type: 'user', text: response, timestamp: Date.now() })
  m.item.status = 'working'
  m.item.updatedAt = Date.now()

  try {
    m.proc.stdin.write(msg)
  } catch (err: any) {
    m.item.status = 'errored'
    m.item.errorMessage = `Write failed: ${err.message}`
    m.item.updatedAt = Date.now()
  }
  notifyRenderer()
}

export function dismissProcess(processId: string): CCQueueItem | null {
  const m = processes.get(processId)
  if (!m) return null

  const finalItem = { ...m.item, status: 'completed' as const, updatedAt: Date.now() }

  try { m.proc.stdin?.end() } catch {}
  setTimeout(() => { try { m.proc.kill() } catch {} }, 1000)
  processes.delete(processId)
  notifyRenderer()
  return finalItem
}

export function killProcess(processId: string) {
  const m = processes.get(processId)
  if (!m) return

  try { m.proc.kill('SIGTERM') } catch {}
  setTimeout(() => { try { m.proc.kill('SIGKILL') } catch {} }, 5000)
  processes.delete(processId)
  notifyRenderer()
}

export function shutdownAllProcesses(): Promise<void> {
  return new Promise((resolve) => {
    for (const [id] of processes) {
      try { processes.get(id)?.proc.kill('SIGTERM') } catch {}
    }
    setTimeout(() => {
      for (const [id] of processes) {
        try { processes.get(id)?.proc.kill('SIGKILL') } catch {}
      }
      processes.clear()
      resolve()
    }, 3000)
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd "C:/Users/chris/mega-agenda" && npx tsc --noEmit 2>&1 | grep "command-center" | head -10`

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add electron/command-center.ts
git commit -m "feat(command-center): add process manager for headless Claude CLI instances"
```

---

### Task 3: IPC Handlers + Preload

**Files:**
- Create: `electron/ipc/command-center.ts`
- Modify: `electron/ipc/index.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Create IPC handler module**

Create `electron/ipc/command-center.ts`:

```typescript
import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  initCommandCenter,
  launchProcess,
  respondToProcess,
  dismissProcess,
  killProcess,
  getQueue,
} from '../command-center'
import {
  getCCHistory,
  addCCHistoryEntry,
  getKnownProjects,
  upsertKnownProject,
  discoverProjects,
} from '../database'
import path from 'path'
import crypto from 'crypto'

export function registerCommandCenterHandlers(mainWindow: BrowserWindow) {
  initCommandCenter(mainWindow)

  ipcMain.handle('cc:launch', async (_, opts: { projectPath: string; prompt: string; model?: string; maxBudget?: number }) => {
    upsertKnownProject(opts.projectPath)
    return launchProcess(opts)
  })

  ipcMain.handle('cc:respond', (_, opts: { processId: string; response: string }) => {
    respondToProcess(opts.processId, opts.response)
  })

  ipcMain.handle('cc:dismiss', (_, opts: { processId: string }) => {
    const item = dismissProcess(opts.processId)
    if (item) {
      // Generate summary from last assistant text
      let summary = item.resultText || 'Task completed'
      if (summary.length > 200) {
        const firstSentence = summary.match(/^[^.!?]+[.!?]/)
        summary = firstSentence ? firstSentence[0] + '...' : summary.slice(0, 200) + '...'
      }

      addCCHistoryEntry({
        id: crypto.randomUUID(),
        projectPath: item.projectPath,
        projectName: item.projectName,
        projectColor: item.projectColor,
        prompt: item.prompt,
        summary,
        filesChanged: item.filesChanged,
        costUsd: item.costUsd,
        turnCount: item.turnCount,
        startedAt: item.startedAt,
        completedAt: Date.now(),
      })
    }
    return item
  })

  ipcMain.handle('cc:kill', (_, opts: { processId: string }) => {
    killProcess(opts.processId)
  })

  ipcMain.handle('cc:get-queue', () => {
    return getQueue()
  })

  ipcMain.handle('cc:get-history', (_, opts?: { filter?: string; limit?: number; offset?: number }) => {
    return getCCHistory(opts?.filter, opts?.limit)
  })

  ipcMain.handle('cc:get-projects', () => {
    return discoverProjects()
  })

  ipcMain.handle('cc:browse-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    })
    if (result.canceled || !result.filePaths[0]) return null
    const projectPath = result.filePaths[0]
    upsertKnownProject(projectPath)
    return { path: projectPath, name: path.basename(projectPath) }
  })
}
```

- [ ] **Step 2: Register in IPC index**

In `electron/ipc/index.ts`, add import and registration:

```typescript
import { registerCommandCenterHandlers } from './command-center'
```

Add inside `registerAllHandlers()`:
```typescript
registerCommandCenterHandlers(mainWindow)
```

- [ ] **Step 3: Add preload bindings**

In `electron/preload.ts`, add after the Agents section (around line 563):

```typescript
  // Command Center
  ccLaunch: (opts: { projectPath: string; prompt: string; model?: string; maxBudget?: number }) =>
    ipcRenderer.invoke('cc:launch', opts),
  ccRespond: (opts: { processId: string; response: string }) =>
    ipcRenderer.invoke('cc:respond', opts),
  ccDismiss: (opts: { processId: string }) =>
    ipcRenderer.invoke('cc:dismiss', opts),
  ccKill: (opts: { processId: string }) =>
    ipcRenderer.invoke('cc:kill', opts),
  ccGetQueue: () => ipcRenderer.invoke('cc:get-queue'),
  ccGetHistory: (opts?: { filter?: string; limit?: number }) =>
    ipcRenderer.invoke('cc:get-history', opts),
  ccGetProjects: () => ipcRenderer.invoke('cc:get-projects'),
  ccBrowseProject: () => ipcRenderer.invoke('cc:browse-project'),
  onCCQueueUpdate: (callback: (queue: any[]) => void) => {
    const handler = (_: any, queue: any[]) => callback(queue)
    ipcRenderer.on('cc:queue-update', handler)
    return () => { ipcRenderer.removeListener('cc:queue-update', handler) }
  },
```

- [ ] **Step 4: Wire graceful shutdown in main.ts**

In `electron/main.ts`, import `shutdownAllProcesses` and add before-quit handler:

```typescript
import { shutdownAllProcesses } from './command-center'
```

In the app lifecycle section, add:

```typescript
app.on('before-quit', async (e) => {
  e.preventDefault()
  await shutdownAllProcesses()
  app.exit(0)
})
```

Note: check if a `before-quit` handler already exists. If so, add `await shutdownAllProcesses()` inside it instead of creating a new one.

- [ ] **Step 5: Verify build compiles**

Run: `cd "C:/Users/chris/mega-agenda" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add electron/ipc/command-center.ts electron/ipc/index.ts electron/preload.ts electron/main.ts
git commit -m "feat(command-center): add IPC handlers, preload bindings, graceful shutdown"
```

---

## Chunk 2: Frontend — Store, Tab Registration, Components

### Task 4: Zustand Store

**Files:**
- Create: `src/store/commandCenterStore.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Create the store**

Create `src/store/commandCenterStore.ts`:

```typescript
import { create } from 'zustand'

export interface CCQueueItem {
  processId: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  status: 'working' | 'awaiting_input' | 'errored'
  resultText?: string
  errorMessage?: string
  filesChanged: string[]
  fullLog: CCStreamMessage[]
  costUsd: number
  turnCount: number
  startedAt: number
  updatedAt: number
}

export interface CCStreamMessage {
  type: string
  subtype?: string
  text?: string
  toolName?: string
  toolInput?: string
  timestamp: number
}

export interface CCHistoryEntry {
  id: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  summary: string
  filesChanged: string[]
  costUsd: number
  turnCount: number
  startedAt: number
  completedAt: number
}

interface KnownProject {
  path: string
  name: string
  lastUsed: number
}

interface CommandCenterState {
  queue: CCQueueItem[]
  history: CCHistoryEntry[]
  historyFilter: string | null
  activeView: 'queue' | 'history'
  launchOpen: boolean
  projects: KnownProject[]

  // Actions
  loadQueue: () => Promise<void>
  loadHistory: (filter?: string | null) => Promise<void>
  loadProjects: () => Promise<void>
  launch: (projectPath: string, prompt: string, opts?: { model?: string; maxBudget?: number }) => Promise<void>
  respond: (processId: string, response: string) => Promise<void>
  dismiss: (processId: string) => Promise<void>
  kill: (processId: string) => Promise<void>
  setActiveView: (view: 'queue' | 'history') => void
  setHistoryFilter: (filter: string | null) => void
  setLaunchOpen: (open: boolean) => void
  updateQueue: (queue: CCQueueItem[]) => void
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  queue: [],
  history: [],
  historyFilter: null,
  activeView: 'queue',
  launchOpen: false,
  projects: [],

  loadQueue: async () => {
    const queue = await window.electronAPI.ccGetQueue()
    set({ queue })
  },

  loadHistory: async (filter) => {
    const f = filter !== undefined ? filter : get().historyFilter
    const history = await window.electronAPI.ccGetHistory({ filter: f || undefined })
    set({ history, historyFilter: f ?? null })
  },

  loadProjects: async () => {
    const projects = await window.electronAPI.ccGetProjects()
    set({ projects })
  },

  launch: async (projectPath, prompt, opts) => {
    await window.electronAPI.ccLaunch({ projectPath, prompt, ...opts })
    set({ launchOpen: false })
  },

  respond: async (processId, response) => {
    await window.electronAPI.ccRespond({ processId, response })
  },

  dismiss: async (processId) => {
    await window.electronAPI.ccDismiss({ processId })
    // Reload history since a new entry was added
    get().loadHistory()
  },

  kill: async (processId) => {
    await window.electronAPI.ccKill({ processId })
  },

  setActiveView: (view) => set({ activeView: view }),
  setHistoryFilter: (filter) => {
    set({ historyFilter: filter })
    get().loadHistory(filter)
  },
  setLaunchOpen: (open) => set({ launchOpen: open }),
  updateQueue: (queue) => set({ queue }),
}))
```

- [ ] **Step 2: Export from barrel**

In `src/store/index.ts`, add:

```typescript
export { useCommandCenterStore } from './commandCenterStore'
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add src/store/commandCenterStore.ts src/store/index.ts
git commit -m "feat(command-center): add Zustand store for queue, history, and projects"
```

---

### Task 5: Tab Registration + Routing

**Files:**
- Modify: `src/store/appStore.ts:4` (Tab type)
- Modify: `src/store/appStore.ts:54-65` (TAB_GROUPS)
- Modify: `src/components/layout/ContentArea.tsx`

- [ ] **Step 1: Add tab to type union**

In `src/store/appStore.ts` line 4, add `'command-center'` to the Tab type:

```typescript
type Tab = 'dashboard' | 'tasks' | 'list' | 'notes' | 'feed' | 'social' | 'chat' | 'code' | 'ai-tasks' | 'memory' | 'memories' | 'roadmap' | 'lab' | 'settings' | 'accounts' | 'network' | 'content' | 'outreach' | 'calendar' | 'agents' | 'sessions' | 'command-center'
```

- [ ] **Step 2: Add tab to AI & Dev group**

In `TAB_GROUPS`, add after `{ id: 'agents', label: 'Agents' }`:

```typescript
{ id: 'command-center', label: 'Command', shortcut: 'x' },
```

- [ ] **Step 3: Add route in ContentArea**

In `src/components/layout/ContentArea.tsx`, add import:

```typescript
import CommandCenter from '../command-center/CommandCenter'
```

Add after `if (activeTab === 'sessions') return <SessionsTab />`:

```typescript
if (activeTab === 'command-center') return <CommandCenter />
```

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add src/store/appStore.ts src/components/layout/ContentArea.tsx
git commit -m "feat(command-center): register tab in navigation and content routing"
```

---

### Task 6: CommandCenter Root Component

**Files:**
- Create: `src/components/command-center/CommandCenter.tsx`

- [ ] **Step 1: Create the root component**

```typescript
import { useEffect } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, EmptyState } from '../ui'
import { Layers, Plus } from 'lucide-react'
import FocusCard from './FocusCard'
import CollapsedCard from './CollapsedCard'
import LaunchCard from './LaunchCard'
import HistoryView from './HistoryView'

export default function CommandCenter() {
  const {
    queue, activeView, launchOpen,
    loadQueue, loadProjects,
    setActiveView, setLaunchOpen,
  } = useCommandCenterStore()

  useEffect(() => {
    loadQueue()
    loadProjects()
    const unsub = window.electronAPI.onCCQueueUpdate((q) => {
      useCommandCenterStore.getState().updateQueue(q)
    })
    return unsub
  }, [])

  const awaitingCount = queue.filter(q => q.status === 'awaiting_input').length
  const workingCount = queue.filter(q => q.status === 'working').length
  const errorCount = queue.filter(q => q.status === 'errored').length

  // Sort: awaiting_input first (FIFO), then errored, then working
  const sorted = [...queue].sort((a, b) => {
    const priority = { awaiting_input: 0, errored: 1, working: 2 }
    const pa = priority[a.status] ?? 3
    const pb = priority[b.status] ?? 3
    if (pa !== pb) return pa - pb
    return a.updatedAt - b.updatedAt
  })

  const focusItem = sorted[0]
  const collapsed = sorted.slice(1)

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white/90">Command Center</h1>
          {queue.length > 0 && (
            <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2.5 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
              <span className="text-[10px] text-white/60 font-medium">{queue.length} active</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px]">
            {awaitingCount > 0 && (
              <span className="text-accent-amber">{awaitingCount} awaiting</span>
            )}
            {workingCount > 0 && (
              <span className="text-accent-emerald">{workingCount} working</span>
            )}
            {errorCount > 0 && (
              <span className="text-accent-red">{errorCount} errored</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setActiveView('queue')}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                activeView === 'queue'
                  ? 'bg-surface-4 text-white/90'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${
                activeView === 'history'
                  ? 'bg-surface-4 text-white/90'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              History
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={() => setLaunchOpen(true)}>
            <Plus size={12} /> New Task
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeView === 'queue' ? (
        queue.length === 0 ? (
          <EmptyState
            icon={<Layers size={20} className="text-white/30" />}
            title="No active tasks"
            description="Launch a Claude CLI instance to get started."
            action={{ label: 'New Task', onClick: () => setLaunchOpen(true) }}
          />
        ) : (
          <div className="space-y-2">
            {focusItem && <FocusCard item={focusItem} />}
            {collapsed.map(item => (
              <CollapsedCard key={item.processId} item={item} />
            ))}
          </div>
        )
      ) : (
        <HistoryView />
      )}

      {/* Launch Modal */}
      {launchOpen && <LaunchCard />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
mkdir -p src/components/command-center
git add src/components/command-center/CommandCenter.tsx
git commit -m "feat(command-center): add root CommandCenter component with header and queue"
```

---

### Task 7: FocusCard Component

**Files:**
- Create: `src/components/command-center/FocusCard.tsx`

- [ ] **Step 1: Create FocusCard**

```typescript
import { useState, useRef, useEffect } from 'react'
import { useCommandCenterStore, CCQueueItem } from '../../store/commandCenterStore'
import { Button, Badge } from '../ui'
import { ChevronRight, Send, Check, X, Loader2, FileEdit, FilePlus, Terminal } from 'lucide-react'
import ConfettiOverlay from './ConfettiOverlay'

export default function FocusCard({ item }: { item: CCQueueItem }) {
  const { respond, dismiss, kill } = useCommandCenterStore()
  const [response, setResponse] = useState('')
  const [showFiles, setShowFiles] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (item.status === 'awaiting_input') inputRef.current?.focus()
  }, [item.status])

  const handleSend = () => {
    if (!response.trim()) return
    respond(item.processId, response.trim())
    setResponse('')
  }

  const handleDone = () => {
    setShowConfetti(true)
    setTimeout(() => {
      dismiss(item.processId)
    }, 2000)
  }

  const handleKill = () => {
    if (!confirmKill) { setConfirmKill(true); return }
    kill(item.processId)
    setConfirmKill(false)
  }

  const statusColor = {
    working: 'text-accent-emerald',
    awaiting_input: 'text-accent-amber',
    errored: 'text-accent-red',
  }[item.status]

  const statusLabel = {
    working: 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const displayText = item.status === 'errored'
    ? item.errorMessage || 'Unknown error'
    : (item.resultText || item.prompt)

  // Truncate display
  const truncated = displayText && displayText.length > 500
  const shownText = truncated ? displayText.slice(0, 500) : displayText
  const [showFullText, setShowFullText] = useState(false)

  return (
    <div className="relative">
      {showConfetti && <ConfettiOverlay color={item.projectColor} onDone={() => setShowConfetti(false)} />}
      <div className={`bg-surface-1 border rounded-xl p-4 ${
        item.status === 'awaiting_input' ? 'border-accent-amber/30' :
        item.status === 'errored' ? 'border-accent-red/30' :
        'border-white/[0.06]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant={item.projectColor === 'blue' ? 'blue' : item.projectColor === 'purple' ? 'purple' : item.projectColor === 'red' ? 'red' : item.projectColor === 'amber' ? 'amber' : 'default'}>
              {item.projectName}
            </Badge>
            <span className={`text-[10px] ${statusColor}`}>{statusLabel}</span>
            {item.status === 'working' && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30">${item.costUsd.toFixed(2)}</span>
            <span className="text-[9px] text-white/20">{Math.round((Date.now() - item.startedAt) / 60000)}m ago</span>
          </div>
        </div>

        {/* Result text */}
        <div className="text-[12px] text-white/80 mb-3 whitespace-pre-wrap leading-relaxed">
          {showFullText ? displayText : shownText}
          {truncated && !showFullText && (
            <button onClick={() => setShowFullText(true)} className="text-accent-blue text-[10px] ml-1">Show more</button>
          )}
        </div>

        {/* Expand toggles */}
        <div className="flex items-center gap-3 mb-3 text-[10px]">
          {item.filesChanged.length > 0 && (
            <button onClick={() => setShowFiles(!showFiles)} className="text-white/40 hover:text-white/60 flex items-center gap-1">
              <ChevronRight size={10} className={`transition-transform ${showFiles ? 'rotate-90' : ''}`} />
              Files changed ({item.filesChanged.length})
            </button>
          )}
          {item.fullLog.length > 0 && (
            <button onClick={() => setShowLog(!showLog)} className="text-white/40 hover:text-white/60 flex items-center gap-1">
              <ChevronRight size={10} className={`transition-transform ${showLog ? 'rotate-90' : ''}`} />
              Full log ({item.fullLog.length})
            </button>
          )}
        </div>

        {/* Expanded: Files */}
        {showFiles && (
          <div className="bg-surface-0 rounded-lg p-3 mb-3 space-y-1">
            {item.filesChanged.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                <FileEdit size={10} /> {f}
              </div>
            ))}
          </div>
        )}

        {/* Expanded: Log */}
        {showLog && (
          <div className="bg-surface-0 rounded-lg p-3 mb-3 max-h-64 overflow-y-auto space-y-2">
            {item.fullLog.map((msg, i) => (
              <div key={i} className={`text-[10px] ${
                msg.type === 'assistant' ? 'text-white/70' :
                msg.type === 'tool_use' ? 'text-accent-cyan/70 font-mono' :
                'text-white/40'
              }`}>
                {msg.type === 'tool_use' ? (
                  <span><Terminal size={9} className="inline mr-1" />{msg.toolName}: {msg.toolInput?.slice(0, 100)}</span>
                ) : (
                  msg.text?.slice(0, 300)
                )}
              </div>
            ))}
          </div>
        )}

        {/* Response input */}
        {item.status === 'awaiting_input' && (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={response}
              onChange={e => setResponse(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Type follow-up..."
              className="flex-1 bg-surface-0 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40 resize-none min-h-[36px] max-h-[120px]"
              rows={1}
            />
            <Button variant="primary" size="sm" onClick={handleSend} disabled={!response.trim()}>
              <Send size={12} />
            </Button>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
          <button onClick={handleKill} className="text-[10px] text-white/20 hover:text-accent-red transition-colors">
            {confirmKill ? 'Confirm kill?' : 'Kill'}
          </button>
          {item.status === 'awaiting_input' && (
            <Button variant="ghost" size="xs" onClick={handleDone}>
              <Check size={10} /> Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add src/components/command-center/FocusCard.tsx
git commit -m "feat(command-center): add FocusCard with expand, respond, done, and kill"
```

---

### Task 8: CollapsedCard, LaunchCard, HistoryView, ConfettiOverlay

**Files:**
- Create: `src/components/command-center/CollapsedCard.tsx`
- Create: `src/components/command-center/LaunchCard.tsx`
- Create: `src/components/command-center/HistoryView.tsx`
- Create: `src/components/command-center/ConfettiOverlay.tsx`

- [ ] **Step 1: Create CollapsedCard**

```typescript
import { CCQueueItem } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { Loader2 } from 'lucide-react'

export default function CollapsedCard({ item }: { item: CCQueueItem }) {
  const statusText = {
    working: 'Working...',
    awaiting_input: 'Awaiting input',
    errored: 'Error',
  }[item.status]

  const opacity = item.status === 'working' ? 'opacity-50' : ''

  return (
    <div className={`bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between ${opacity} hover:opacity-100 transition-opacity cursor-pointer`}>
      <div className="flex items-center gap-2">
        <Badge>{item.projectName}</Badge>
        <span className="text-[10px] text-white/40 truncate max-w-[200px]">
          {item.resultText?.slice(0, 60) || item.prompt.slice(0, 60)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {item.status === 'working' && <Loader2 size={10} className="text-accent-emerald animate-spin" />}
        <span className={`text-[9px] ${
          item.status === 'awaiting_input' ? 'text-accent-amber' :
          item.status === 'errored' ? 'text-accent-red' :
          'text-accent-emerald'
        }`}>{statusText}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create LaunchCard**

```typescript
import { useState, useEffect } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, Input, Dialog } from '../ui'
import { Rocket, FolderOpen } from 'lucide-react'

export default function LaunchCard() {
  const { projects, launch, setLaunchOpen, loadProjects } = useCommandCenterStore()
  const [projectPath, setProjectPath] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('sonnet')
  const [maxBudget, setMaxBudget] = useState('')

  useEffect(() => { loadProjects() }, [])

  const handleBrowse = async () => {
    const result = await window.electronAPI.ccBrowseProject()
    if (result) {
      setProjectPath(result.path)
      loadProjects()
    }
  }

  const handleLaunch = () => {
    if (!projectPath || !prompt.trim()) return
    const modelMap: Record<string, string> = {
      opus: 'claude-opus-4-6',
      sonnet: 'claude-sonnet-4-5-20250929',
      haiku: 'claude-haiku-4-5-20251001',
    }
    launch(projectPath, prompt.trim(), {
      model: modelMap[model],
      maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
    })
  }

  const canLaunch = projectPath && prompt.trim()

  return (
    <Dialog open onClose={() => setLaunchOpen(false)}>
      <div className="bg-surface-1 border border-white/[0.08] rounded-xl w-[480px] p-5">
        <h2 className="text-sm font-semibold text-white/90 mb-4">New Task</h2>

        {/* Project */}
        <div className="mb-3">
          <label className="text-[11px] text-muted font-medium mb-1 block">Project</label>
          <div className="flex gap-2">
            <select
              value={projectPath}
              onChange={e => setProjectPath(e.target.value)}
              className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-accent-blue/40"
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.path} value={p.path}>{p.name} — {p.path}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={handleBrowse}>
              <FolderOpen size={14} />
            </Button>
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-3">
          <label className="text-[11px] text-muted font-medium mb-1 block">Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="What should Claude do?"
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40 resize-none min-h-[80px]"
            rows={3}
          />
        </div>

        {/* Model + Budget row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-[11px] text-muted font-medium mb-1 block">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-accent-blue/40"
            >
              <option value="sonnet">Sonnet</option>
              <option value="opus">Opus</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>
          <div className="flex-1">
            <Input
              label="Max Budget (USD)"
              type="number"
              step="0.50"
              min="0"
              value={maxBudget}
              onChange={e => setMaxBudget(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLaunchOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleLaunch}
            disabled={!canLaunch}
          >
            <Rocket size={12} /> Launch
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create HistoryView**

```typescript
import { useEffect, useState } from 'react'
import { useCommandCenterStore, CCHistoryEntry } from '../../store/commandCenterStore'
import { Badge } from '../ui'
import { ChevronRight, Clock, DollarSign, FileEdit } from 'lucide-react'

export default function HistoryView() {
  const { history, historyFilter, projects, loadHistory, setHistoryFilter } = useCommandCenterStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { loadHistory() }, [])

  const uniqueProjects = [...new Set(history.map(h => h.projectName))]

  return (
    <div>
      {/* Filter */}
      <div className="mb-3">
        <select
          value={historyFilter || ''}
          onChange={e => setHistoryFilter(e.target.value || null)}
          className="bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-1.5 text-[10px] text-white/70 focus:outline-none"
        >
          <option value="">All Projects</option>
          {uniqueProjects.map(name => (
            <option key={name} value={history.find(h => h.projectName === name)?.projectPath || ''}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Entries */}
      {history.length === 0 ? (
        <p className="text-[11px] text-white/30 text-center py-8">No history yet.</p>
      ) : (
        <div className="space-y-1">
          {history.map(entry => (
            <div key={entry.id}>
              <div
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="bg-surface-1 border border-white/[0.04] rounded-lg px-4 py-2.5 flex items-center justify-between cursor-pointer hover:border-white/[0.08] transition-all"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ChevronRight size={10} className={`text-white/20 transition-transform flex-shrink-0 ${expandedId === entry.id ? 'rotate-90' : ''}`} />
                  <Badge>{entry.projectName}</Badge>
                  <span className="text-[10px] text-white/60 truncate">{entry.summary}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-[9px] text-white/20 flex items-center gap-1">
                    <DollarSign size={8} />{entry.costUsd.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-white/20 flex items-center gap-1">
                    <FileEdit size={8} />{entry.filesChanged.length}
                  </span>
                  <span className="text-[9px] text-white/20">
                    {new Date(entry.completedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === entry.id && (
                <div className="bg-surface-0 border border-white/[0.04] rounded-b-lg px-4 py-3 -mt-1 space-y-2">
                  <div>
                    <span className="text-[9px] text-white/30 uppercase">Prompt</span>
                    <p className="text-[11px] text-white/60 mt-0.5">{entry.prompt}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/30 uppercase">Summary</span>
                    <p className="text-[11px] text-white/60 mt-0.5">{entry.summary}</p>
                  </div>
                  {entry.filesChanged.length > 0 && (
                    <div>
                      <span className="text-[9px] text-white/30 uppercase">Files ({entry.filesChanged.length})</span>
                      <div className="mt-1 space-y-0.5">
                        {entry.filesChanged.map((f, i) => (
                          <div key={i} className="text-[10px] text-white/40 font-mono">{f}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-4 text-[9px] text-white/30 pt-1">
                    <span>Cost: ${entry.costUsd.toFixed(4)}</span>
                    <span>Turns: {entry.turnCount}</span>
                    <span>Duration: {Math.round((entry.completedAt - entry.startedAt) / 60000)}m</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create ConfettiOverlay**

```typescript
import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 60
const DURATION = 2500

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
}

const COLOR_MAP: Record<string, string[]> = {
  blue: ['#3b82f6', '#60a5fa', '#93c5fd'],
  purple: ['#8b5cf6', '#a78bfa', '#c4b5fd'],
  red: ['#ef4444', '#f87171', '#fca5a5'],
  cyan: ['#06b6d4', '#22d3ee', '#67e8f9'],
  green: ['#22c55e', '#4ade80', '#86efac'],
  orange: ['#f97316', '#fb923c', '#fdba74'],
  amber: ['#f59e0b', '#fbbf24', '#fcd34d'],
  pink: ['#ec4899', '#f472b6', '#f9a8d4'],
}

export default function ConfettiOverlay({ color, onDone }: { color: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const colors = COLOR_MAP[color] || COLOR_MAP.blue
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 100,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 8 - 2,
      size: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    }))

    const start = Date.now()
    let raf: number

    const animate = () => {
      const elapsed = Date.now() - start
      if (elapsed > DURATION) { onDone(); return }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const alpha = 1 - elapsed / DURATION

      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.15 // gravity
        p.y += p.vy
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }

      raf = requestAnimationFrame(animate)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [color, onDone])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-50 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd "C:/Users/chris/mega-agenda" && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/chris/mega-agenda"
git add src/components/command-center/
git commit -m "feat(command-center): add CollapsedCard, LaunchCard, HistoryView, ConfettiOverlay"
```

---

## Chunk 3: Integration + Verification

### Task 9: TypeScript Types + Final Wiring

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add CC types to ElectronAPI interface**

If `src/types/index.ts` has an `ElectronAPI` interface, add the CC methods. If not (the types are only in preload), skip this step — the preload bindings are sufficient.

Check: `grep "ElectronAPI" src/types/index.ts`

If it exists, add:
```typescript
// Command Center
ccLaunch: (opts: { projectPath: string; prompt: string; model?: string; maxBudget?: number }) => Promise<any>
ccRespond: (opts: { processId: string; response: string }) => Promise<void>
ccDismiss: (opts: { processId: string }) => Promise<any>
ccKill: (opts: { processId: string }) => Promise<void>
ccGetQueue: () => Promise<any[]>
ccGetHistory: (opts?: { filter?: string; limit?: number }) => Promise<any[]>
ccGetProjects: () => Promise<any[]>
ccBrowseProject: () => Promise<{ path: string; name: string } | null>
onCCQueueUpdate: (callback: (queue: any[]) => void) => () => void
```

- [ ] **Step 2: Commit if changes were made**

```bash
cd "C:/Users/chris/mega-agenda"
git add src/types/index.ts
git commit -m "feat(command-center): add TypeScript types for electronAPI bindings"
```

---

### Task 10: Build + Manual Verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd "C:/Users/chris/mega-agenda" && npx tsc --noEmit 2>&1 | head -30`

Fix any new errors (pre-existing errors in GoalDetailView, TimelineView, etc. are expected and can be ignored).

- [ ] **Step 2: Dev build test**

Run: `cd "C:/Users/chris/mega-agenda" && npm run dev`

Verify:
1. App launches without crash
2. AI & Dev group shows "Command" tab
3. Clicking "Command" shows empty state with "No active tasks"
4. "New Task" button opens launch modal
5. Project dropdown is populated from `~/.claude/projects/`
6. Browse button opens native directory picker

- [ ] **Step 3: Launch a test task**

In the Command Center:
1. Select any project (e.g., mega-agenda itself)
2. Type prompt: "What files are in the src/store/ directory? List them briefly."
3. Click Launch
4. Verify: card appears with "working" status
5. Verify: after Claude responds, card transitions to "awaiting_input"
6. Verify: result text shows the file listing
7. Click "Done" → verify confetti animation plays → card moves to history

- [ ] **Step 4: Test multi-turn**

1. Launch: "Read package.json and tell me the app name"
2. When it responds, type follow-up: "What version of React is it using?"
3. Verify the follow-up reaches Claude and a new result comes back

- [ ] **Step 5: Test history persistence**

1. Complete a task (click Done)
2. Switch to History tab → verify entry appears
3. Quit and relaunch app → verify history persists
4. Verify queue is empty after restart (ephemeral by design)

- [ ] **Step 6: Final commit + push**

```bash
cd "C:/Users/chris/mega-agenda"
git add -A
git status  # verify only command-center related files
git commit -m "feat(command-center): complete integration and verification"
git push
```
