export default function DynamicList({ label, items, onChange, placeholder }: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-muted uppercase tracking-wider">{label}</label>
        <button
          onClick={() => onChange([...items, ''])}
          className="text-[10px] text-accent-blue hover:text-accent-blue/80"
        >+ Add</button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1">
          <input
            type="text"
            value={item}
            onChange={e => {
              const updated = [...items]
              updated[i] = e.target.value
              onChange(updated)
            }}
            placeholder={placeholder}
            className="flex-1 bg-surface-3/50 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white placeholder:text-muted focus:outline-none"
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-muted hover:text-accent-red text-xs px-1"
          >×</button>
        </div>
      ))}
    </div>
  )
}
