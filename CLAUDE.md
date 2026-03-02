# Mega Agenda

Personal life management Electron app -- dashboard for tasks, goals, notes, AI chat, bank sync, social media, and voice commands.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Desktop**: Electron 28 (contextIsolation: true, nodeIntegration: false)
- **Build**: Vite + vite-plugin-electron
- **Database**: JSON file persisted via fs.writeFileSync (`%APPDATA%/mega-agenda/mega-agenda.json`)
- **AI**: Multi-provider LLM (Claude, Gemini, Groq, OpenRouter) via `electron/llm.ts`
- **Embeddings**: @xenova/transformers (MiniLM-L6-v2, 384-dim local embeddings)
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
- `electron/vector-store.ts` -- Local vector index for semantic search
- `electron/knowledge-pack.ts` -- Knowledge compression, clustering, fact extraction
- `electron/memory.ts` -- Memory extraction from chat/CLI/journal sources
- `electron/smart-query.ts` -- RAG-powered Q&A streaming
- `electron/bank-sync/` -- SimpleFIN + Teller API clients and sync orchestrator
- `electron/ipc/` -- 10 handler modules registered via `registerAllHandlers()`
- `src/App.tsx` -- Root component with tab navigation
- `src/store/` -- Zustand stores: appStore, taskStore, chatStore, socialStore
- `src/components/` -- All UI components (~87 files across layout, bank-sync, chat, roadmap, social, settings, ui subdirectories)
- `src/types/index.ts` -- Shared types including ElectronAPI interface
- `src/hooks/` -- 9 custom hooks (keyboard shortcuts, streaming, auto-save, etc.)

## Key Patterns
- All main<->renderer communication via IPC (invoke/handle pattern)
- Database is a single JSON file, auto-migrates missing fields on startup
- Models load in main process with 5s startup delay
- 15 tabs across 4 groups: Daily (dashboard, tasks, list, journal, accounts), Social (feed, social, chat), AI & Dev (code, context, memories, roadmap, ai-tasks, lab), Settings
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
