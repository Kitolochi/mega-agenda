# Mega Agenda

Personal life management Electron app -- dashboard for tasks, goals, notes, AI chat, bank sync, social media, and voice commands.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Desktop**: Electron 28 (contextIsolation: true, nodeIntegration: false)
- **Build**: Vite + vite-plugin-electron
- **Database**: JSON file persisted via fs.writeFileSync (`%APPDATA%/mega-agenda/mega-agenda.json`)
- **AI**: Multi-provider LLM (Claude, Gemini, Groq, OpenRouter) via `electron/llm.ts`
- **Embeddings**: @xenova/transformers (MiniLM-L6-v2, 384-dim local embeddings)
- **Search**: Hybrid — LanceDB vector search + MiniSearch BM25, merged via Reciprocal Rank Fusion (RRF)
- **Speech**: Local Whisper via @xenova/transformers (Xenova/whisper-tiny.en)
- **Terminal**: xterm.js + node-pty
- **Bank Sync**: SimpleFIN Bridge + Teller APIs

## Architecture
- `electron/main.ts` -- Main process: BrowserWindow, IPC handlers, model loading
- `electron/preload.ts` -- Bridge: exposes `window.electronAPI` via contextBridge
- `electron/database.ts` -- JSON database with all CRUD operations (~1800 lines)
- `electron/llm.ts` -- Multi-provider LLM support (Claude, Gemini, Groq, OpenRouter)
- `electron/research.ts` -- Goal research, master plan synthesis, RAG context retrieval
- `electron/embeddings.ts` -- Local embedding model (Xenova/all-MiniLM-L6-v2)
- `electron/whisper.ts` -- Local Whisper transcription (Xenova/whisper-tiny.en)
- `electron/vector-store.ts` -- Hybrid search: LanceDB vector + BM25, RRF fusion, session indexing
- `electron/bm25-index.ts` -- MiniSearch BM25 full-text index with disk persistence
- `electron/session-parser.ts` -- Claude Code JSONL session parser (968+ sessions → searchable chunks)
- `electron/knowledge-pack.ts` -- Knowledge compression, clustering, fact extraction
- `electron/memory.ts` -- Memory extraction from chat/CLI/journal sources
- `electron/smart-query.ts` -- RAG-powered Q&A streaming (hybrid search, transparent to consumers)
- `electron/bank-sync/` -- SimpleFIN + Teller API clients and sync orchestrator
- `electron/agents.ts` -- Agent orchestration: heartbeat scheduler, session polling, cost aggregation
- `electron/ipc/` -- 11 handler modules registered via `registerAllHandlers()`
- `src/App.tsx` -- Root component with tab navigation
- `src/store/` -- Zustand stores: appStore, taskStore, chatStore, socialStore, agentStore
- `src/components/` -- All UI components (~93 files across layout, agents, bank-sync, chat, roadmap, social, settings, ui subdirectories)
- `src/types/index.ts` -- Shared types including ElectronAPI interface
- `src/hooks/` -- 9 custom hooks (keyboard shortcuts, streaming, auto-save, etc.)

## Key Patterns
- All main<->renderer communication via IPC (invoke/handle pattern)
- Database is a single JSON file, auto-migrates missing fields on startup
- Models load in main process with 5s startup delay
- 16 tabs across 4 groups: Daily (dashboard, tasks, list, journal, accounts, calendar), Social (feed, social, network, outreach, chat), AI & Dev (code, context, memories, roadmap, ai-tasks, content, agents, lab), Settings
- Dark glassmorphic theme: surface-0 (#0c0c0e) through surface-4, accent colors in tailwind.config.cjs
- Fonts: Instrument Sans (display), DM Sans (body)
- Custom frameless window with `frame: false`, `show: false`, `ready-to-show` handler
- Bank sync: SimpleFIN (token exchange → access URL → sync) and Teller (bearer token → sync), MD5 dedup for transactions

## Known Issues
- Voice commands: VoiceButton causes white screen (DOM renders correctly but visually white). Paused pending investigation.
- Electron 28 does not support Web Speech API (Google blocks it in shell environments) -- replaced with local Whisper
- Pre-existing TS errors (9): GoalDetailView, TimelineView, TopicListView, RoadmapTab, VoiceButton, CodeTerminal, AllTasks — these do not block the build

## Commands
- `npm run dev` -- Start Vite dev server + Electron
- `npm run build` -- Production build (Vite + electron-builder)
- `npm run test` -- Run vitest
- `npm run typecheck` -- TypeScript check (noEmit)
- `npm run lint` -- ESLint
- `npm run format` -- Prettier

## Agent Orchestration — Test Flows

### Flow 1: Tab Discovery
1. `npm run dev`
2. Expand the **AI & Dev** group in the left sidebar
3. Click **Agents** — should render the Agents tab with "No agents yet" empty state
4. Verify the 4 sub-view tabs appear: Overview, Issues, Costs, History
5. Click each sub-view — each should render without errors (empty states)

### Flow 2: Create an Agent
1. Click **+ New Agent** button
2. Fill in: Name = "Code Agent", Role = Engineer, Description = "Writes code", Task Type = Code
3. Set Working Directory to an existing project path (e.g. `C:\Users\YOUR_USERNAME\mega-agenda`)
4. Leave budget at $0 (unlimited), heartbeat unchecked
5. Click **Create**
6. Verify the agent card appears in Overview with:
   - Green "idle" status dot
   - Role badge "Engineer"
   - No budget bar (unlimited)
   - Run / Pause / Edit buttons

### Flow 3: Edit & Delete an Agent
1. Click **Edit** on the Code Agent card
2. Change the name to "Code Bot", set monthly budget to $5
3. Click **Save** — card should update with new name and budget bar ($0.00 / $5.00)
4. Click **Edit** again, click **Delete**, then **Confirm Delete**
5. Agent disappears from Overview

### Flow 4: Create Issues on the Kanban Board
1. Create a new agent first (or use an existing one)
2. Switch to **Issues** sub-view
3. Click **+ New Issue**
4. Fill: Title = "Implement feature X", Priority = High, assign to your agent
5. Click **Create** — issue appears in the Backlog column
6. Create a second issue: Title = "Write tests", Priority = Medium, same agent
7. Click an issue card to expand it — description and move buttons appear
8. Click **todo** to move the first issue to Todo column
9. Click **in progress** to move it to In Progress
10. Verify the agent filter dropdown works (filters to assigned agent only)

### Flow 5: Manual Agent Run (launches Claude Code)
1. Have an agent with a `cwd` set to a valid project directory
2. Have at least one issue in **Todo** status assigned to that agent
3. From the Overview, click **Run** on the agent card
4. Expected: A new terminal window opens with Claude Code running
5. The agent card status dot turns purple (running) with pulse animation
6. Switch to **History** sub-view — a new run entry appears with status "running"
7. Click the run row to expand — shows the prompt, started time, agent name

### Flow 6: Mark a Run Complete
1. After a terminal finishes (or to test without waiting):
2. In History, expand a "running" run entry
3. Click **Mark Done** — run status changes to "succeeded"
4. The agent status dot returns to blue (idle)
5. The linked issue moves to "in_review" status on the Kanban board

### Flow 7: Pause / Resume an Agent
1. Click **Pause** on an agent card — status dot turns amber, button changes to "Resume"
2. A paused agent will not auto-run heartbeats even if scheduled
3. Click **Resume** — status returns to idle (blue), heartbeats can fire again

### Flow 8: Heartbeat Scheduling
1. Edit an agent, check **Enable Heartbeat Schedule**
2. Set trigger to **Interval**, interval to **1** minute (for testing)
3. Save the agent
4. Wait ~60 seconds — the heartbeat scheduler should auto-trigger
5. A terminal should launch and a new run appears in History
6. Change to **Daily** trigger with a time, verify it only fires once per day at/after that time

### Flow 9: Cost Dashboard
1. Switch to **Costs** sub-view
2. With no cost events yet, all cards show $0.00 / 0 tokens / 0 events
3. Toggle period selector (Today / Week / Month) — each renders without errors
4. Cost events are created when session polling detects completed runs with token data
5. (Manual test: insert a cost event via devtools console to verify bars and table render)

### Flow 10: Data Persistence
1. Create agents, issues, and trigger runs
2. Quit the app completely (right-click tray → Quit)
3. Relaunch with `npm run dev`
4. Navigate to Agents tab — all agents, issues, and history should persist
5. Verify the JSON db file at `%APPDATA%/mega-agenda/mega-agenda.json` contains `agents`, `agentIssues`, `heartbeatRuns`, `costEvents` arrays
