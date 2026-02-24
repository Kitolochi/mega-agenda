# Mega Agenda

Personal life management Electron app -- dashboard for tasks, goals, notes, AI chat, social media, and voice commands.

## Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron 28 (contextIsolation: true, nodeIntegration: false)
- **Build**: Vite + vite-plugin-electron
- **AI**: @xenova/transformers (local embeddings + Whisper), Anthropic API (Claude)
- **Terminal**: xterm.js + node-pty

## Architecture
- `electron/main.ts` -- Main process: BrowserWindow, IPC handlers, model loading
- `electron/preload.ts` -- Bridge: exposes `window.electronAPI` via contextBridge
- `electron/embeddings.ts` -- Local embedding model (Xenova/all-MiniLM-L6-v2)
- `electron/whisper.ts` -- Local Whisper transcription (Xenova/whisper-tiny.en)
- `src/App.tsx` -- Root component with tab navigation
- `src/components/` -- All UI components (27 files)
- `src/types/index.ts` -- Shared types including ElectronAPI interface

## Key Patterns
- All main<->renderer communication via IPC (invoke/handle pattern)
- Models load in main process with 5s startup delay
- Dark theme: surface-0 (#0c0c0e) through surface-4, accent colors in tailwind.config.cjs
- Fonts: Instrument Sans (display), DM Sans (body)
- Custom frameless window with `frame: false`, `show: false`, `ready-to-show` handler

## Known Issues
- Voice commands: VoiceButton causes white screen (DOM renders correctly but visually white). Paused pending investigation.
- Electron 28 does not support Web Speech API (Google blocks it in shell environments) -- replaced with local Whisper

## Commands
- `npm run dev` -- Start Vite dev server + Electron
- `npm run build` -- Production build
