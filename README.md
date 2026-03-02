# Mega Agenda

A personal productivity powerhouse that lives in your system tray. Task management, AI chat, goal research, bank account sync, Twitter posting, RSS feeds, embedded terminal, voice commands, and more — all in a single compact Electron window.

Built with Electron + React + TypeScript + Tailwind CSS + Claude AI.

## Features

### Task Management
- Organize tasks by category (Work, Health, Finance, etc.) with priorities, due dates, and color-coded icons
- Recurring tasks (daily, weekly, monthly) with auto-reset
- Category cards with completion rings and quick filters
- Add custom categories with emoji icons and colors

### Dashboard
- AI-generated morning briefing (overdue tasks, priorities, streak info)
- Progress ring with motivational messages
- 90-day activity heatmap
- Live debt summary card (auto-syncs from connected bank accounts)
- Weekly stats and streak tracking
- Category grid for quick navigation

### Daily Journal
- Date-based note editor with auto-save
- Calendar picker with visual indicators for days with notes
- Navigate between days or jump to today
- AI-powered weekly reviews with task counts, focus time, and category breakdowns
- Historical review archive

### Bank Accounts (Live Sync)
- **SimpleFIN Bridge** integration — 16,000+ banks via MX aggregator ($15/year, read-only)
- **Teller** integration — direct bank connections (free, real-time)
- Connect wizard: choose provider, paste token, auto-sync
- Live debt/balance tracking across all connected accounts
- Financial overview: total debt, total assets, per-account breakdown
- Transaction list with account filtering and pending indicators
- Connection status monitoring with manual sync
- Auto-sync on dashboard load when stale (>1 hour)
- MD5-based transaction deduplication

### Feed Reader (RSS + Twitter)
- Multi-section feed aggregation (AI/LLMs, World News)
- Add/remove RSS feeds with 30+ suggested sources (HN, Reddit, arXiv, etc.)
- Twitter/X list integration via bearer token
- AI-powered article summarization per section
- Cached summaries with refresh

### Twitter / Social Media Manager
- Compose single tweets or threaded posts
- Draft management with status tracking (draft → refining → ready → posted)
- AI writing assistant: brainstorm, refine, analyze tweet effectiveness
- Pre-built refinement actions (make punchier, add hook, contrarian angle, etc.)
- Persona system — 5 built-in (Paul Graham, Naval, Snarky Critic, Builder, Thought Leader) + custom personas
- OAuth v2 integration for posting directly to Twitter
- Sequential thread posting with reply chaining
- Character counter and copy-to-clipboard

### Chat (Claude AI)
- Multiple conversation threads with persistent history
- Streaming responses with abort support
- Multi-provider LLM support (Claude, Gemini, Groq, OpenRouter)
- Model selection (Sonnet 4.5, Haiku 4.5, Opus 4.6)
- System prompt modes: default, context-aware (includes tasks/streak/notes), or custom
- Token usage tracking per message
- Memory integration — extract and inject memories into context
- Smart Query (`/ask`) — RAG-powered Q&A with semantic search over knowledge base

### Code Terminal
- Embedded terminal powered by node-pty + xterm.js
- Full Windows CMD shell with copy/paste (Ctrl+C/V)
- Auto-fit on window resize
- Custom dark color theme
- Always-mounted for instant access

### AI Tasks (Kanban Board)
- 4-column workflow: Backlog → Todo → In Progress → Done
- Tasks with title, description, priority, and tags
- Auto-launch Claude Code CLI sessions from tasks
- GitHub repo search for context injection
- Opens in external terminal windows
- Inline editing with expandable detail view

### Roadmap / Goal Planning
- Create goals with category, priority, status, target quarter/year
- AI-generated research questions and guidance needs per goal
- Parallel batch research (3 topics at a time, CLI-first with API fallback)
- Individual topic reports saved as markdown
- Action plan synthesis from all research
- Context questionnaire for personalization
- Goal workspaces with deliverables and git tracking

### Master Plan
- Cross-goal master plan synthesis using all research + context files
- **RAG-powered smart context retrieval** — semantic search selects the most relevant chunks instead of brute-forcing all files
- Local embeddings (MiniLM-L6-v2, 384-dim) with vector index (~1,174 chunks)
- Falls back to brute-force if embeddings unavailable
- Task extraction from plan (10-30 actionable items)
- Execution dashboard with task launching via Claude Code CLI
- Auto-polling to match launched tasks with CLI sessions

### Context Files (Knowledge Base)
- File manager for `~/.claude/memory/` directory
- Create, edit, delete files and folders
- Upload files from disk
- Domain scaffolding — auto-generates 8 domain folders (career, health, financial, relationships, learning, projects, personal, creative) with profile templates
- Auto-synced goal context files (_overview.md, topic reports, action plans)
- AI-driven reorganization tool — analyzes files, suggests moves/merges/deletes, backs up before executing

### Memories (Structured Knowledge)
- Create, edit, delete, archive, and pin memories
- Importance levels (1-3) with topic/tag coloring
- Source tracking: chat, CLI session, journal, task, AI task, or manual
- AI-powered batch extraction from all sources
- Topic management: rename, recolor, merge, delete
- Search by title/content/topic, filter by source type
- Memory injection into chat context
- Knowledge pack compression — cluster and summarize memories into dense packs
- Memory health monitoring with auto-pruning

### Lab (Experimental Tools)
- Single-file compression testing
- Embedding similarity testing
- Compression audit with coverage scoring

### CLI History Viewer
- Browse all Claude Code CLI sessions from `~/.claude/projects/`
- View full conversations with pagination (50 messages at a time)
- Full-text search across all sessions
- Extract memories from sessions
- Quick-link from AI tasks to related sessions

### Voice Commands (Experimental)
- Currently being reworked — migrating from Web Speech API (not supported in Electron 28) to local Whisper transcription
- Local fallback parsing for navigation and basic commands
- AI parsing via Claude for complex commands
- Visual feedback: pulsing indicator, transcript banner, success/error states

| Command | Example |
|---------|---------|
| Switch tab | "Go to feed", "Show dashboard" |
| Add task | "Add task to work: finish the report, high priority" |
| Complete task | "Mark done buy groceries" |
| New task modal | "New task" |
| Journal note | "Note: met with Sarah about the project" |
| Summarize feed | "Summarize AI news" |

### Pomodoro Timer
- 25-minute focus sessions linked to tasks
- Task picker with search
- Auto-start breaks (5 min short / 15 min long every 4 sessions)
- Native OS notifications on session complete
- Session counter for the day

### Settings
- Multi-provider LLM configuration (Claude, Gemini, Groq, OpenRouter)
- API key storage and verification per provider
- Twitter OAuth credentials (API keys, access tokens)
- Category management (add/delete with icons and colors)
- RSS feed management with suggested feeds
- Keyboard shortcuts reference

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| N | New task |
| D | Dashboard |
| T | Tasks |
| L | List view |
| J | Journal |
| B | Bank accounts |
| F | Feed |
| M | Social / Twitter |
| H | Chat |
| C | Code terminal |
| A | AI Tasks |
| Y | Context files |
| R | Roadmap |
| S | Settings |
| V | Voice command |
| P | Pomodoro timer |
| 1-7 | Select category (on dashboard) |
| Esc | Back / Close |

## Architecture

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Electron 28 (main + preload + renderer)
- **State:** Zustand stores (app, task, chat, social)
- **Database:** JSON file (`mega-agenda.json`) persisted to `%APPDATA%/mega-agenda/`
- **AI:** Multi-provider LLM support — Claude API (Sonnet 4.5 / Haiku 4.5 / Opus 4.6), Gemini, Groq, OpenRouter
- **Embeddings:** @xenova/transformers with MiniLM-L6-v2 (384-dim, ~22MB, cached locally)
- **Terminal:** node-pty + xterm.js
- **Speech:** Local Whisper via @xenova/transformers (migrating from Web Speech API, which is unsupported in Electron 28)
- **Twitter:** Twitter API v2 (OAuth 1.0a for posting, bearer token for reading)
- **Bank Sync:** SimpleFIN Bridge (16K+ banks via MX) + Teller (direct connections)

### Data Storage
- **JSON DB:** `%APPDATA%/mega-agenda/mega-agenda.json` — tasks, categories, notes, stats, settings, conversations, drafts, goals, memories, bank connections, bank accounts, transactions
- **Context files:** `~/.claude/memory/` — markdown knowledge base with domain folders and goal research
- **Master plans:** `~/.claude/master-plans/` — dated plan files
- **Vector index:** `%APPDATA%/mega-agenda/vector-index.json` — embedding vectors for semantic search
- **Model cache:** `%APPDATA%/mega-agenda/models/` — cached MiniLM and Whisper models

### Project Structure
```
electron/                  # Main process
  main.ts                  # Entry point, BrowserWindow, model loading
  preload.ts               # contextBridge API (window.electronAPI)
  database.ts              # JSON DB with all CRUD operations
  llm.ts                   # Multi-provider LLM (Claude, Gemini, Groq, OpenRouter)
  research.ts              # Goal research, master plan, RAG
  embeddings.ts            # MiniLM-L6-v2 local embeddings
  whisper.ts               # Local Whisper transcription
  vector-store.ts          # Local vector index for semantic search
  knowledge-pack.ts        # Knowledge compression and clustering
  memory.ts                # Memory extraction from sources
  smart-query.ts           # RAG-powered Q&A streaming
  bank-sync/               # Bank account sync
    simplefin.ts           # SimpleFIN API client
    teller.ts              # Teller API client
    sync.ts                # Sync orchestrator with deduplication
  ipc/                     # IPC handler modules
    index.ts               # Handler registration barrel
    tasks.ts, notes.ts, chat.ts, twitter.ts, rss.ts,
    ai.ts, memory.ts, system.ts, knowledge-pack.ts, bank-sync.ts

src/                       # Renderer (React)
  App.tsx                  # Root component
  types/index.ts           # Shared types + ElectronAPI interface
  store/                   # Zustand stores (app, task, chat, social)
  hooks/                   # Custom hooks (9 files)
  utils/                   # Utilities (cn, formatting, markdown, sounds, tts)
  components/
    layout/                # AppShell, TitleBar, TabNavigation, ContentArea
    bank-sync/             # AccountsTab, ConnectBankDialog, DebtSummary, ConnectionStatus
    chat/                  # ChatView, ChatSidebar, ChatMessages, ChatInput, SmartQuery
    roadmap/               # GoalForm, GoalDetail, Timeline, TopicList, Execution, MasterPlan
    social/                # TweetEditor, ThreadEditor, DraftSelector, PersonaSelector, AIAssist
    settings/              # Settings, AIProvider, Categories, Feeds, Twitter
    ui/                    # Primitives (Button, Input, Card, Badge, Dialog, etc.)
    ...                    # Dashboard, Tasks, Feed, Terminal, Memories, Lab, etc.
```

### Window Management
- Frameless window with custom title bar
- System tray icon with context menu (Open, Quick Add Task, Quit)
- Single instance lock — second launch focuses existing window
- Hide on close (minimize to tray)

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/Kitolochi/mega-agenda.git
cd mega-agenda
npm install
npm run dev
```

### Build Portable EXE

```bash
npm run build
```

The executable will be in `release/`.

### Optional Setup
- **Claude API Key** — Required for AI features (chat, research, summaries, master plan). Set in Settings tab.
- **Multi-LLM Providers** — Optionally configure Gemini, Groq, or OpenRouter as alternative providers in Settings.
- **Twitter Credentials** — Required for tweet posting. Set bearer token for reading, OAuth for posting in Settings.
- **Claude Code CLI** — Install globally for CLI-first research and task launching: `npm install -g @anthropic-ai/claude-code`
- **SimpleFIN Bridge** — $15/year for live bank sync. Sign up at [simplefin.org](https://beta-bridge.simplefin.org), connect banks, paste setup token in Accounts tab.
