# Command Center — Design Spec

_Date: 2026-03-11_
_Location: mega-agenda → new tab in "AI & Dev" group_

## Overview

A new tab in mega-agenda that orchestrates multiple headless Claude Code CLI instances across projects. The user launches tasks, and the tool surfaces only what needs attention — questions, blockers, completions — in a prioritized focus queue. No terminal noise. Just decisions.

## Core User Flow

1. User opens Command Center tab
2. Clicks "New Task" → Launch Card appears
3. Picks project, writes prompt, optionally sets model/budget
4. Hits launch → mega-agenda spawns a headless Claude CLI process
5. Card appears in collapsed stack as "working"
6. When Claude has a question or finishes → card rises to Focus Queue
7. User sees the question (minimal), can expand for full context/files/log
8. Types response → piped back to CLI via stdin → card clears → next slides up
9. Completion cards show confetti animation when opened
10. Resolved cards move to Session History

## Architecture

### Process Management (Electron Main)

Each task spawns a Claude CLI child process:

```
claude -p "<prompt>" \
  --output-format stream-json \
  --input-format stream-json \
  --dangerously-skip-permissions \
  --no-session-persistence
```

The main process:
- Spawns via `child_process.spawn`
- Reads stdout line-by-line (stream-json = newline-delimited JSON)
- Parses each message for type: `assistant`, `tool_use`, `tool_result`, `input_request`, `completion`
- When an `input_request` arrives (Claude needs user input), pushes a card to the queue
- When the user responds, writes to the process stdin as stream-json
- Tracks process lifecycle: spawning → working → needs_input → working → completed/errored

### IPC Channels

New module: `electron/ipc/command-center.ts`

| Channel | Direction | Payload |
|---------|-----------|---------|
| `cc:launch` | renderer → main | `{ projectPath, prompt, model?, maxBudget? }` |
| `cc:respond` | renderer → main | `{ processId, response }` |
| `cc:kill` | renderer → main | `{ processId }` |
| `cc:get-queue` | renderer → main | returns active queue state |
| `cc:get-history` | renderer → main | `{ filter?: projectPath, limit, offset }` |
| `cc:queue-update` | main → renderer | pushed via mainWindow.webContents.send when queue changes |

### Zustand Store

New store: `src/store/commandCenterStore.ts`

```typescript
interface CommandCenterState {
  // Active processes
  queue: QueueItem[]

  // History
  history: HistoryEntry[]
  historyFilter: string | null  // null = all projects, string = project path

  // Launch card
  launchOpen: boolean

  // Actions
  launch: (projectPath: string, prompt: string, opts?: LaunchOpts) => Promise<void>
  respond: (processId: string, response: string) => Promise<void>
  kill: (processId: string) => Promise<void>
  loadHistory: (filter?: string) => Promise<void>
}

interface QueueItem {
  processId: string
  projectPath: string
  projectName: string        // derived from path (last segment)
  projectColor: string       // consistent color per project
  prompt: string             // original launch prompt
  status: 'working' | 'needs_input' | 'completed' | 'errored'
  currentQuestion?: string   // the question/blocker text
  context?: string           // summary of what Claude was doing
  filesChanged?: string[]    // files modified so far
  fullLog?: StreamMessage[]  // complete conversation for expand view
  startedAt: number
  updatedAt: number
}

interface HistoryEntry {
  id: string
  projectPath: string
  projectName: string
  projectColor: string
  prompt: string
  summary: string           // AI-generated summary of what was done
  filesChanged: string[]
  startedAt: number
  completedAt: number
  totalMessages: number
}

interface LaunchOpts {
  model?: string
  maxBudget?: number
}
```

### Data Persistence

Session history stored in the existing mega-agenda JSON database under a new `commandCenterHistory` key. Same `saveDatabase()` pattern as everything else.

### Known Projects

The launch card needs to know project directories. Source these from:
1. Memory file: `~/.claude/projects/` (Claude Code already tracks projects here)
2. Hardcoded fallback list from the user's known projects
3. Manual "Browse" option as escape hatch

## UI Components

### 1. Focus Queue (main view)

```
┌─────────────────────────────────────────┐
│ Command Center     2 need input · 3 working │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ FOCUS CARD (dominant) ────────────┐ │
│  │ herring-shop              2m ago   │ │
│  │                                    │ │
│  │ Which invoice numbering scheme:    │ │
│  │ sequential or date-prefixed?       │ │
│  │                                    │ │
│  │ ▸ Show context                     │ │
│  │ ▸ Show files changed               │ │
│  │ ▸ Show full log                    │ │
│  │                                    │ │
│  │ ┌──────────────────────┐ ┌──────┐  │ │
│  │ │ Type response...     │ │ Send │  │ │
│  │ └──────────────────────┘ └──────┘  │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ collapsed ────────────────────────┐ │
│  │ mega-agenda    Done — review?      │ │
│  └────────────────────────────────────┘ │
│  ┌─ collapsed (faded) ───────────────┐  │
│  │ twitter-ext    ● working...       │  │
│  └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

- Top card = highest priority (needs_input first, then completed, then working)
- Priority within same status: oldest first (FIFO)
- Collapsed cards clickable to promote to focus
- Status bar at top shows aggregate counts
- Completion cards trigger confetti animation (canvas overlay, 2-3 second burst) when expanded
- "New Task" button in top-right opens Launch Card

### 2. Launch Card (modal/overlay)

```
┌─────────────────────────────────────────┐
│ New Task                           ✕    │
├─────────────────────────────────────────┤
│                                         │
│ Project                                 │
│ ┌─────────────────────────────────┐     │
│ │ herring-shop-system         ▼   │     │
│ └─────────────────────────────────┘     │
│                                         │
│ Prompt                                  │
│ ┌─────────────────────────────────┐     │
│ │                                 │     │
│ │ Build the invoice module...     │     │
│ │                                 │     │
│ └─────────────────────────────────┘     │
│                                         │
│ Model (optional)                        │
│ ┌─────────────────────────────────┐     │
│ │ claude-sonnet-4-5-20250929  ▼   │     │
│ └─────────────────────────────────┘     │
│                                         │
│ Max Budget (optional)                   │
│ ┌─────────────────────────────────┐     │
│ │ $5.00                           │     │
│ └─────────────────────────────────┘     │
│                                         │
│              ┌────────────────┐         │
│              │    Launch      │         │
│              └────────────────┘         │
└─────────────────────────────────────────┘
```

- Project dropdown auto-populated from known project directories
- Prompt is a textarea (multi-line)
- Model defaults to current default (sonnet), dropdown for opus/haiku
- Budget optional, no default

### 3. Expanded Card (inline expand)

When the user clicks "Show context" / "Show files changed" / "Show full log", the focus card expands inline:

- **Context**: 2-3 sentence summary of what Claude was doing when it hit the question
- **Files changed**: List of file paths modified so far, with +/- line counts
- **Full log**: Scrollable conversation history (Claude messages + tool uses), styled like a simplified terminal output

### 4. Session History (sub-view)

Toggle between the queue and history via tabs at the top: **Queue | History**

- Default: chronological timeline across all projects
- Filter dropdown: "All Projects" or specific project name
- Each entry: project badge, date, prompt summary, AI-generated summary of outcome, file count
- Clickable to expand full details

## Styling

Follows existing mega-agenda patterns:
- Surface-0 through surface-4 backgrounds
- Glassmorphic cards with subtle borders
- Project colors: consistent accent color assigned per project path (hash-based)
- Status colors: green (working), amber (needs input), blue (completed), red (errored)
- Confetti: lightweight canvas animation, 50-80 particles, 2-3 second duration, project's accent color

## Tab Registration

Add to `TAB_GROUPS` in appStore.ts under "AI & Dev" group:
- Key: `command-center`
- Label: "Command Center"
- Icon: Terminal or Layers icon
- Shortcut: assign next available

Add to ContentArea.tsx routing.

## Stream JSON Protocol

Claude CLI with `--output-format stream-json` emits newline-delimited JSON objects. Key message types to handle:

| Type | Meaning | Action |
|------|---------|--------|
| `assistant` | Claude is speaking | Append to log, check if it's a question |
| `tool_use` | Claude is calling a tool | Append to log, track files |
| `tool_result` | Tool returned a result | Append to log |
| `result` | Final output, process complete | Mark as completed, generate summary |
| `error` | Process error | Mark as errored |

Detecting "needs input": When `--input-format stream-json` is used and Claude needs a response, it will output a message and pause stdout. The main process detects this pause (no new messages for N seconds while process is still alive) combined with the last message being a question.

## Edge Cases

- **Process crash**: Mark as errored, show error card with last known state
- **User kills process**: Confirm dialog, then SIGTERM → SIGKILL after 5s
- **Multiple questions queued**: FIFO ordering, all cards visible in collapsed stack
- **App restart**: Running processes are lost (by design — `--no-session-persistence`). History persists.
- **Project path no longer exists**: Show warning badge on card, still display history

## Verification

- [ ] Can launch a Claude CLI instance from the UI and see it appear as "working"
- [ ] When Claude asks a question, card transitions to "needs input" and shows the question
- [ ] Can type a response and have it reach the CLI process
- [ ] Completion card shows confetti animation
- [ ] Session history persists across app restarts
- [ ] Can run 3+ instances simultaneously without UI freezing
- [ ] Kill button terminates the process gracefully
- [ ] History view filters by project correctly
