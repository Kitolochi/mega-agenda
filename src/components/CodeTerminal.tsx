import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

function keyToData(e: KeyboardEvent): string | null {
  if (e.ctrlKey && e.key.length === 1) {
    const code = e.key.toLowerCase().charCodeAt(0) - 96
    if (code > 0 && code < 27) return String.fromCharCode(code)
  }
  switch (e.key) {
    case 'Enter': return '\r'
    case 'Backspace': return '\x7f'
    case 'Escape': return '\x1b'
    case 'Tab': return '\t'
    case 'ArrowUp': return '\x1b[A'
    case 'ArrowDown': return '\x1b[B'
    case 'ArrowRight': return '\x1b[C'
    case 'ArrowLeft': return '\x1b[D'
    case 'Home': return '\x1b[H'
    case 'End': return '\x1b[F'
    case 'Delete': return '\x1b[3~'
    case 'PageUp': return '\x1b[5~'
    case 'PageDown': return '\x1b[6~'
    default:
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) return e.key
      return null
  }
}

export default function CodeTerminal({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const spawnedRef = useRef(false)
  const activeRef = useRef(active)

  // Keep activeRef in sync so the keydown closure always has the latest value
  activeRef.current = active

  // One-time terminal setup — never tears down
  useEffect(() => {
    const el = containerRef.current
    if (!el || termRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#0c0c0e',
        foreground: '#e0e0e0',
        cursor: '#6c8eef',
        selectionBackground: '#6c8eef40',
        black: '#1a1a1f',
        red: '#ef6b73',
        green: '#7ec699',
        yellow: '#fac863',
        blue: '#6c8eef',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#d8dee9',
        brightBlack: '#545464',
        brightRed: '#ef6b73',
        brightGreen: '#7ec699',
        brightYellow: '#fac863',
        brightBlue: '#6c8eef',
        brightMagenta: '#c792ea',
        brightCyan: '#89ddff',
        brightWhite: '#eceff4',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(el)
    term.attachCustomKeyEventHandler(() => false)
    termRef.current = term

    // PTY output → xterm
    window.electronAPI.onTerminalData((data: string) => {
      term.write(data)
    })

    // Global keyboard capture — only sends when active
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (!activeRef.current) return

      // Handle paste (Ctrl+V or Ctrl+Shift+V)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        try {
          const text = window.electronAPI.readClipboard()
          if (text) window.electronAPI.writeTerminal(text)
        } catch {}
        return
      }

      // Handle copy (Ctrl+C when there's a selection, otherwise send SIGINT)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const selection = term.getSelection()
        if (selection) {
          e.preventDefault()
          e.stopImmediatePropagation()
          window.electronAPI.writeClipboard(selection)
          return
        }
        // No selection — fall through to send Ctrl+C (SIGINT) to PTY
      }

      const data = keyToData(e)
      if (data) {
        e.preventDefault()
        e.stopImmediatePropagation()
        window.electronAPI.writeTerminal(data)
      }
    }
    document.addEventListener('keydown', onDocKeyDown, true)

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (!activeRef.current) return
      try {
        fitAddon.fit()
        const { cols, rows } = term
        window.electronAPI.resizeTerminal(cols, rows)
      } catch {}
    })
    observer.observe(el)

    // Spawn PTY
    setTimeout(() => {
      if (spawnedRef.current) return
      spawnedRef.current = true
      try { fitAddon.fit() } catch {}
      const { cols, rows } = term
      window.electronAPI.createTerminal(cols, rows)
    }, 100)

    // No cleanup — terminal lives for the lifetime of the app
  }, [])

  // Re-fit when becoming visible
  useEffect(() => {
    if (active && termRef.current) {
      setTimeout(() => {
        try {
          const fit = termRef.current as any
          // Access the fit addon through the terminal's loaded addons is not straightforward,
          // so just trigger a resize event which the ResizeObserver will pick up
          containerRef.current?.dispatchEvent(new Event('resize'))
        } catch {}
      }, 50)
    }
  }, [active])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        padding: '4px 0 0 4px',
        background: '#0c0c0e',
        WebkitAppRegion: 'no-drag',
        display: active ? 'block' : 'none',
      }}
    />
  )
}
