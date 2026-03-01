import { useState, useEffect, useCallback } from 'react'
import { Category } from '../../types'

const inputClass = "w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 focus:bg-surface-3 transition-all placeholder-muted/50"

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('')
  const [newCatColor, setNewCatColor] = useState('#8b5cf6')

  const loadData = useCallback(async () => {
    const cats = await window.electronAPI.getCategories()
    setCategories(cats)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="mb-6">
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Categories</label>
      <div className="space-y-1 mb-2">
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card">
            <span className="text-sm">{c.icon}</span>
            <span className="text-[11px] text-white/80 flex-1">{c.name}</span>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            {c.id > 7 && (
              <button
                onClick={async () => {
                  await window.electronAPI.deleteCategory(c.id)
                  loadData()
                }}
                className="text-muted hover:text-accent-red transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex gap-1.5 items-center">
          <input
            type="text"
            value={newCatIcon}
            onChange={e => setNewCatIcon(e.target.value)}
            placeholder="icon"
            className={`${inputClass} !w-8 !px-1 text-center text-sm shrink-0`}
            maxLength={2}
          />
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Category name"
            className={`${inputClass} flex-1 min-w-0`}
          />
          <input
            type="color"
            value={newCatColor}
            onChange={e => setNewCatColor(e.target.value)}
            className="w-8 h-8 rounded-lg bg-surface-2 border border-white/[0.06] cursor-pointer shrink-0 p-0.5"
          />
        </div>
        <button
          onClick={async () => {
            if (!newCatName.trim()) return
            await window.electronAPI.addCategory(newCatName.trim(), newCatColor, newCatIcon || '📌')
            setNewCatName('')
            setNewCatIcon('')
            setNewCatColor('#8b5cf6')
            loadData()
          }}
          disabled={!newCatName.trim()}
          className="w-full py-2 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-xs text-accent-blue font-medium transition-all"
        >
          Add Category
        </button>
      </div>
    </div>
  )
}
