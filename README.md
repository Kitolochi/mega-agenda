# Mega Agenda

A personal productivity app that lives in your system tray. Manage tasks across life categories, keep a daily journal, aggregate news feeds, and get AI-powered summaries — all from a single compact window.

Built with Electron + React + TypeScript + Tailwind CSS.

## Features

- **Task Management** — Organize tasks by category (Work, Health, Finance, etc.) with priorities, due dates, and recurring schedules
- **Daily Journal** — Quick daily notes with history
- **Feed Reader** — RSS and Twitter/X list aggregation in one view
- **AI Summarization** — Claude-powered summaries of your feeds (AI/tech news and geopolitics)
- **Voice Control** — Hands-free commands via the mic button or `V` key — add tasks, switch tabs, complete items by voice
- **System Tray** — Runs in the tray, pops up on click, hides on blur
- **Keyboard Shortcuts** — `N` new task, `D` dashboard, `T` tasks, `J` journal, `F` feed, `V` voice, `1-7` categories

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

## Voice Commands

Voice control works via the mic button in the title bar or the `V` key. Basic navigation works without an API key. Full command parsing requires a Claude API key (set in the Feed tab settings).

| Command | Example |
|---------|---------|
| Switch tab | "Go to feed", "Show dashboard" |
| Add task | "Add task to work: finish the report, high priority" |
| Complete task | "Mark done buy groceries" |
| New task modal | "New task" |
| Journal note | "Note: met with Sarah about the project" |
| Summarize feed | "Summarize AI news" |

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Electron 28 (main + preload + renderer)
- **Database:** SQLite (via better-sqlite3, bundled)
- **AI:** Claude Haiku API for feed summarization and voice command parsing
- **Speech:** Web Speech API (built into Chromium/Electron)
