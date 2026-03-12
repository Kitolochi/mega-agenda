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
6. When Claude finishes a turn → card rises to Focus Queue with the result text
7. User sees the output (minimal), can expand for full context/files/log
8. Types follow-up response → piped back to CLI via stdin → card returns to "working"
9. Completion cards (user dismisses or sends empty) show confetti animation
10. Resolved cards move to Session History

## Architecture

### Process Management (Electron Main)

Each task spawns a Claude CLI child process via `child_process.spawn`:

```
claude -p \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  --dangerously-skip-permissions \
  --no-session-persistence \
  --max-budget-usd <budget>  // if set
  --model <model>            // if set
```

The `cwd` is set to the selected project directory.

**Permission note**: `--dangerously-skip-permissions` bypasses all Claude safety checks (file edits, bash commands, etc.). This is intentional — the Command Center itself is the user's approval layer. Each task is explicitly launched by the user with a specific prompt and project scope.

### Stream JSON Protocol (Verified)

The CLI emits newline-delimited JSON on stdout. Tested message types:

| Type | Subtype | Meaning | Action |
|------|---------|---------|--------|
| `system` | `init` | Session initialized | Store session metadata (tools, model) |
| `system` | `hook_started` | Pre-tool hook firing | Ignore (internal) |
| `system` | `hook_response` | Hook completed | Ignore (internal) |
| `assistant` | — | Claude's response | Parse `message.content[]` for text and tool_use blocks |
| `user` | — | Tool result echoed back | Append to log (indicates tool executed) |
| `result` | `success` | **Turn complete** | Extract result text, cost, num_turns. **This is the signal that Claude is done and waiting for input.** |
| `result` | `error` | Turn failed | Mark as errored, show error message |

**Multi-turn protocol** (verified via testing):
1. Send `{"type":"user","message":{"role":"user","content":"<prompt>"}}\n` to stdin
2. Read stream of `system` → `assistant` → optional `user` (tool results) → `result`
3. On receiving `result`, the turn is complete — process is alive and waiting for next stdin message
4. Send next user message to continue, or close stdin to end the session

**No pause detection needed.** The `result` message is the explicit, reliable signal that Claude has finished its turn. This eliminates the false-positive problem entirely.

### Detecting "Needs Input" vs "Completed"

Every `result` message means Claude finished a turn. The Command Center treats every `result` as "needs input" — the card surfaces to the user with Claude's output. The user then either:
- **Responds** — types a follow-up, which sends a new user message to stdin
- **Dismisses** — marks the task as complete, which closes stdin and kills the process

There is no ambiguity. Claude never "asks a question mid-task" in print mode — it runs to completion of the prompt, uses tools as needed, and returns a result. If the task requires multiple rounds of input, the user drives that explicitly.

### File Change Tracking

Extracted from `assistant` messages containing `tool_use` content blocks:
- `Edit` tool uses → record `file_path`
- `Write` tool uses → record `file_path`
- `Bash` tool uses → record command text (for log display)

Parsed from `message.content[]` array where items have `type: "tool_use"` and `name` matching Edit/Write.

### Cost Tracking

Each `result` message includes `total_cost_usd` and `usage` breakdown (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`). Per-model usage is in `modelUsage`.

Store cost data on the QueueItem and persist to HistoryEntry on completion. Cost is stored directly on `HistoryEntry.costUsd` — no separate cost events table. The Command Center does **not** share the `costEvents` table from `agents.ts`. Each system tracks cost independently.

### Summary Generation

When a task is marked complete (user dismisses the final result card):
1. Take the last `assistant` message text content (Claude's final output)
2. If it's short enough (< 200 chars), use it directly as the summary
3. If longer, truncate to first sentence + "..."
4. No separate LLM call needed — Claude's own output is the summary

### IPC Channels

New module: `electron/ipc/command-center.ts`

| Channel | Direction | Payload |
|---------|-----------|---------|
| `cc:launch` | renderer → main | `{ projectPath, prompt, model?, maxBudget? }` |
| `cc:respond` | renderer → main | `{ processId, response }` |
| `cc:dismiss` | renderer → main | `{ processId }` — marks complete, kills process |
| `cc:kill` | renderer → main | `{ processId }` — force kill without completing |
| `cc:get-queue` | renderer → main | returns active queue state |
| `cc:get-history` | renderer → main | `{ filter?: projectPath, limit, offset }` |
| `cc:queue-update` | main → renderer | pushed via `mainWindow.webContents.send` when queue changes |

### Zustand Store

New store: `src/store/commandCenterStore.ts`

```typescript
interface CommandCenterState {
  // Active processes
  queue: QueueItem[]

  // History
  history: HistoryEntry[]
  historyFilter: string | null  // null = all projects, string = project path

  // Sub-view
  activeView: 'queue' | 'history'

  // Launch card
  launchOpen: boolean

  // Actions
  launch: (projectPath: string, prompt: string, opts?: LaunchOpts) => Promise<void>
  respond: (processId: string, response: string) => Promise<void>
  dismiss: (processId: string) => Promise<void>
  kill: (processId: string) => Promise<void>
  loadHistory: (filter?: string) => Promise<void>
  setActiveView: (view: 'queue' | 'history') => void
  setHistoryFilter: (filter: string | null) => void
}

interface QueueItem {
  processId: string
  projectPath: string
  projectName: string        // derived from path (last segment)
  projectColor: string       // accent color per project: simple string hash mod 8 into existing accent array
  prompt: string             // original launch prompt
  status: 'working' | 'awaiting_input' | 'completed' | 'errored'
  resultText?: string        // Claude's latest output text
  errorMessage?: string      // error details if errored
  filesChanged: string[]     // accumulated from tool_use events
  fullLog: StreamMessage[]   // complete conversation for expand view
  costUsd: number            // accumulated cost across turns
  turnCount: number          // number of result messages received
  startedAt: number
  updatedAt: number
}

interface StreamMessage {
  type: string
  subtype?: string
  text?: string              // extracted text content
  toolName?: string          // for tool_use blocks
  toolInput?: string         // summarized tool input
  timestamp: number
}

interface HistoryEntry {
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

interface LaunchOpts {
  model?: string
  maxBudget?: number
}
```

### Data Persistence

Add to the existing mega-agenda JSON database:

```typescript
// In Database interface (electron/database.ts)
commandCenterHistory: HistoryEntry[]
knownProjects: KnownProject[]

interface KnownProject {
  path: string
  name: string
  lastUsed: number
}
```

Queue state is **ephemeral** — active processes are lost on app restart (by design, since `--no-session-persistence` means they can't be resumed). Only history and known projects persist.

Migration: `initDatabase()` adds empty arrays for both fields if missing (same pattern as all existing migrations).

### Known Projects Discovery

1. **User-managed list** — stored in `knownProjects` in the database. Added via the Launch Card's "Browse" button or automatically when a task is launched for a new path.
2. **Auto-populated on first use** — scan `~/.claude/projects/` for subdirectories that contain a `CLAUDE.md`. Directory names encode the original path with `--` replacing path separators (e.g., `C--Users-chris-mega-agenda` → `C:\Users\chris\mega-agenda`). Parse by splitting on `--` and joining with `\`.
3. **Browse fallback** — Electron `dialog.showOpenDialog` for selecting any directory.

Projects are sorted by `lastUsed` in the dropdown.

### Relationship to Existing Agent System

The Command Center is a **separate, simpler system** that coexists with the existing Agents tab (`agents.ts`):

| | Agents Tab | Command Center |
|---|---|---|
| **Purpose** | Autonomous agents with schedules, issues, budgets | Manual task dispatch across projects |
| **Lifecycle** | Heartbeat-triggered, long-running | User-launched, per-task |
| **Terminal** | External terminal window (cmd.exe) | Headless child process |
| **Tracking** | Issues, runs, cost events | Focus queue, session history |
| **Database** | `agents`, `agentIssues`, `heartbeatRuns`, `costEvents` | `commandCenterHistory`, `knownProjects` |

No migration path needed. They serve different use cases. The Agents tab is for autonomous scheduled work; Command Center is for interactive multi-project orchestration.

## UI Components

### 1. Focus Queue (main view)

```
┌─────────────────────────────────────────┐
│ Command Center     2 awaiting · 3 working │
│ [Queue] [History]          [+ New Task] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ FOCUS CARD (dominant) ────────────┐ │
│  │ herring-shop              2m ago   │ │
│  │                                    │ │
│  │ Built the invoice schema with      │ │
│  │ sequential numbering. Created      │ │
│  │ 3 files in src/modules/invoice/.   │ │
│  │                                    │ │
│  │ ▸ Show files changed (3)          │ │
│  │ ▸ Show full log (12 messages)     │ │
│  │                                    │ │
│  │ ┌──────────────────────┐ ┌──────┐  │ │
│  │ │ Type follow-up...    │ │ Send │  │ │
│  │ └──────────────────────┘ └──────┘  │ │
│  │                        [✓ Done]    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ collapsed ────────────────────────┐ │
│  │ mega-agenda    Awaiting input      │ │
│  └────────────────────────────────────┘ │
│  ┌─ collapsed (faded) ───────────────┐  │
│  │ twitter-ext    ● working...       │  │
│  └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

- Top card = highest priority: `awaiting_input` first (FIFO), then `errored`, then `working`
- Collapsed cards clickable to promote to focus
- Status bar shows aggregate counts with colored dots
- "Done" button on awaiting_input cards → marks complete, triggers confetti
- Confetti: CSS keyframe animation, 50-80 particles in project's accent color, 2-3 second burst
- Empty state when no tasks: "No active tasks. Launch one to get started."

### 2. Launch Card (modal overlay)

- **Project dropdown**: sorted by `lastUsed`, shows project name + path. "Browse..." option at bottom.
- **Prompt textarea**: multi-line, auto-grows, placeholder "What should Claude do?"
- **Model dropdown**: defaults to sonnet. Options: opus, sonnet, haiku.
- **Max budget input**: optional numeric, USD. Empty = no limit.
- **Launch button**: disabled until project + prompt are filled
- **Keyboard shortcut**: Ctrl+Enter to launch

### 3. Expanded Card (inline expand)

When user clicks expand toggles on the focus card:

- **Files changed**: List of file paths with icons (edit vs. create). No +/- line counts (not available from stream-json).
- **Full log**: Scrollable container with each message styled:
  - Assistant text → left-aligned, surface-2 background
  - Tool uses → monospace, surface-3 background, shows tool name + truncated input
  - Results → right-aligned, subtle border

### 4. Session History (sub-view)

Toggle via `[Queue] [History]` tabs at top.

- Default: reverse chronological across all projects
- Filter dropdown: "All Projects" | each known project by name
- Each row: `[project badge] [date] [prompt truncated] [summary] [$cost] [files count]`
- Clickable to expand: shows full prompt, full summary, files list, cost breakdown, turn count
- No pagination needed initially — load last 100, add "Load more" if needed

## Styling

Follows existing mega-agenda patterns:
- Surface-0 through surface-4 backgrounds
- Glassmorphic cards with `border border-white/5` and subtle backdrop blur
- Project colors: hash project path to one of the 8 existing accent colors (blue, purple, red, cyan, green, orange, amber, pink)
- Status colors: green (working), amber (awaiting input), blue (completed), red (errored)
- Confetti: CSS `@keyframes` with pseudo-elements or a small `<canvas>` overlay. No external dependency.
- Consistent with existing UI primitives: Button, Input, Card, Badge, Dialog from `src/components/ui/`

## Tab Registration

Add to `TAB_GROUPS` in `appStore.ts` under "AI & Dev" group:
- Key: `command-center`
- Label: "Command Center"
- Icon: `Layers` from lucide-react (or `Terminal`)
- Position: after `agents` tab

Add routing in `ContentArea.tsx`:
```typescript
if (activeTab === 'command-center') return <CommandCenter />
```

## Error Handling

- **Process crash (non-zero exit)**: Mark as `errored`, show error card with exit code and last stderr output. User can dismiss.
- **stdin write to dead process (EPIPE)**: Catch in IPC handler, mark as errored, surface to user.
- **JSON parse failure on stdout**: Log the raw line, skip it, continue processing. Don't crash the queue.
- **Concurrent process limit**: Hard limit of 10 simultaneous processes. Warn in UI at > 5. Launch Card disables at 10 with message "Max concurrent tasks reached."
- **App quit / graceful shutdown**: On `app.before-quit`, SIGTERM all running Command Center processes. Wait up to 3s, then SIGKILL any survivors. Do not block quit indefinitely.

## Edge Cases

- **User kills process**: Confirm dialog ("Kill this task? Claude is still working."), then SIGTERM → SIGKILL after 5s
- **App restart**: Running processes are lost. History persists. Queue shows empty on restart.
- **Project path deleted**: History entries still display with path. Launch card shows warning if selected project path doesn't exist.
- **Very long output**: Truncate `resultText` display to 500 chars with "Show more" toggle. Full text available in expanded log.
- **Rapid result messages**: If Claude completes very fast (trivial prompt), the card may flash through working→awaiting. This is fine — the card just appears directly as awaiting_input.

## Verification

- [ ] Can launch a Claude CLI instance from the Launch Card and see it appear as "working" in the queue
- [ ] When `result` message arrives, card transitions to "awaiting_input" and shows Claude's output text
- [ ] Can type a follow-up response and have it sent to the CLI process as a new turn
- [ ] "Done" button closes stdin, kills process, triggers confetti animation, moves to history
- [ ] Session history persists across app restarts with correct summary, cost, and file data
- [ ] Can run 3+ instances simultaneously without UI freezing (main process handles I/O async)
- [ ] Kill button terminates the process gracefully with confirmation
- [ ] History view toggles between chronological and per-project filter
- [ ] Known projects list auto-updates when new projects are used
- [ ] Error states display correctly (process crash, EPIPE on dead process)
- [ ] Cost tracking accumulates across multi-turn sessions
