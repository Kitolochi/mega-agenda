export type DatePreset = 'this-month' | 'last-month' | '3m' | '6m' | 'ytd' | 'all' | 'custom'

export interface DateRange {
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
}

function pad(n: number) { return n.toString().padStart(2, '0') }
function toYMD(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export function getDefaultRange(preset: DatePreset): DateRange {
  const now = new Date()
  const today = toYMD(now)

  switch (preset) {
    case 'this-month':
      return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today }
    case 'last-month': {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: toYMD(lm), end: toYMD(lmEnd) }
    }
    case '3m': {
      const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      return { start: toYMD(d), end: today }
    }
    case '6m': {
      const d = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      return { start: toYMD(d), end: today }
    }
    case 'ytd':
      return { start: `${now.getFullYear()}-01-01`, end: today }
    case 'all':
      return { start: '2000-01-01', end: today }
    case 'custom':
      return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today }
  }
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
]

interface DateRangeBarProps {
  range: DateRange
  preset: DatePreset
  onPresetChange: (preset: DatePreset) => void
  onRangeChange: (range: DateRange) => void
}

export default function DateRangeBar({ range, preset, onPresetChange, onRangeChange }: DateRangeBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map(p => (
        <button
          key={p.id}
          onClick={() => {
            onPresetChange(p.id)
            if (p.id !== 'custom') onRangeChange(getDefaultRange(p.id))
          }}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            preset === p.id
              ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/20'
              : 'bg-surface-2/50 text-muted hover:text-white/70 border border-white/[0.06]'
          }`}
        >
          {p.label}
        </button>
      ))}

      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={range.start}
            onChange={e => onRangeChange({ ...range, start: e.target.value })}
            className="bg-surface-2/80 border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white [color-scheme:dark]"
          />
          <span className="text-[10px] text-muted">to</span>
          <input
            type="date"
            value={range.end}
            onChange={e => onRangeChange({ ...range, end: e.target.value })}
            className="bg-surface-2/80 border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white [color-scheme:dark]"
          />
        </div>
      )}
    </div>
  )
}
