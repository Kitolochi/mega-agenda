import { useState, useEffect, useCallback } from 'react'
import { Memory, MemoryTopic, MemorySettings, ContextFile } from '../types'
import MemoryTimeline from './MemoryTimeline'
import MemoryGraph from './MemoryGraph'

type SourceFilter = 'all' | 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual'
type SortMode = 'newest' | 'importance'
type ViewMode = 'cards' | 'timeline' | 'graph'

const SOURCE_ICONS: Record<string, string> = {
  chat: '💬',
  cli_session: '⌨️',
  journal: '📝',
  task: '✅',
  ai_task: '🤖',
  manual: '✍️',
}

const IMPORTANCE_COLORS: Record<number, string> = {
  1: 'bg-white/20',
  2: 'bg-accent-blue',
  3: 'bg-accent-red',
}

const IMPORTANCE_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Normal',
  3: 'High',
}

const TOPIC_PRESET_COLORS = [
  '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171',
  '#c084fc', '#fb923c', '#38bdf8', '#4ade80', '#f472b6',
]

export default function MemoryTab() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [topics, setTopics] = useState<MemoryTopic[]>([])
  const [settings, setSettings] = useState<MemorySettings | null>(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showTopicManager, setShowTopicManager] = useState(false)
  const [editingTopicName, setEditingTopicName] = useState<string | null>(null)
  const [topicRenameValue, setTopicRenameValue] = useState('')
  const [mergeSelections, setMergeSelections] = useState<Set<string>>(new Set())
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [showContextForm, setShowContextForm] = useState(false)
  const [ctxFileName, setCtxFileName] = useState('')
  const [ctxFileContent, setCtxFileContent] = useState('')
  const [editingContextFile, setEditingContextFile] = useState<string | null>(null)
  const [deletingContextFile, setDeletingContextFile] = useState<string | null>(null)

  // Add/edit form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTopics, setFormTopics] = useState('')
  const [formImportance, setFormImportance] = useState<1 | 2 | 3>(2)

  const loadData = useCallback(async () => {
    const [mems, tops, sets, ctxFiles] = await Promise.all([
      window.electronAPI.getMemories(),
      window.electronAPI.getMemoryTopics(),
      window.electronAPI.getMemorySettings(),
      window.electronAPI.getContextFiles(),
    ])
    setMemories(mems)
    setTopics(tops)
    setSettings(sets)
    setContextFiles(ctxFiles)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = memories.filter(m => {
    if (sourceFilter !== 'all' && m.sourceType !== sourceFilter) return false
    if (topicFilter && !m.topics.includes(topicFilter)) return false
    if (search) {
      const q = search.toLowerCase()
      return m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.topics.some(t => t.toLowerCase().includes(q))
    }
    return true
  }).sort((a, b) => {
    if (sortMode === 'importance') {
      if (b.importance !== a.importance) return b.importance - a.importance
    }
    // Pinned first
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleAdd = async () => {
    if (!formTitle.trim()) return
    const topicList = formTopics.split(',').map(t => t.trim()).filter(Boolean)
    await window.electronAPI.createMemory({
      title: formTitle.trim(),
      content: formContent.trim(),
      topics: topicList,
      sourceType: 'manual',
      sourceId: null,
      sourcePreview: '',
      importance: formImportance,
      isPinned: false,
      isArchived: false,
      relatedMemoryIds: [],
    })
    setFormTitle(''); setFormContent(''); setFormTopics(''); setFormImportance(2)
    setShowAddForm(false)
    await loadData()
  }

  const handleEdit = async (id: string) => {
    const mem = memories.find(m => m.id === id)
    if (!mem) return
    setEditingId(id)
    setFormTitle(mem.title)
    setFormContent(mem.content)
    setFormTopics(mem.topics.join(', '))
    setFormImportance(mem.importance)
    setShowAddForm(true)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !formTitle.trim()) return
    const topicList = formTopics.split(',').map(t => t.trim()).filter(Boolean)
    await window.electronAPI.updateMemory(editingId, {
      title: formTitle.trim(),
      content: formContent.trim(),
      topics: topicList,
      importance: formImportance,
    })
    setEditingId(null)
    setFormTitle(''); setFormContent(''); setFormTopics(''); setFormImportance(2)
    setShowAddForm(false)
    await loadData()
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteMemory(id)
    if (expandedId === id) setExpandedId(null)
    await loadData()
  }

  const handlePin = async (id: string) => {
    await window.electronAPI.pinMemory(id)
    await loadData()
  }

  const handleArchive = async (id: string) => {
    await window.electronAPI.archiveMemory(id)
    if (expandedId === id) setExpandedId(null)
    await loadData()
  }

  const handleSaveSettings = async (updates: Partial<MemorySettings>) => {
    const s = await window.electronAPI.saveMemorySettings(updates)
    setSettings(s)
  }

  const handleExtractFromChat = async () => {
    setExtracting(true)
    try {
      await window.electronAPI.batchExtractMemories()
      await loadData()
    } catch { /* ignore */ }
    setExtracting(false)
  }

  // Topic management handlers
  const handleTopicRename = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingTopicName(null)
      return
    }
    // Update all memories that reference the old topic name
    const affectedMemories = memories.filter(m => m.topics.includes(oldName))
    for (const mem of affectedMemories) {
      const updatedTopics = mem.topics.map(t => t === oldName ? newName.trim() : t)
      await window.electronAPI.updateMemory(mem.id, { topics: updatedTopics })
    }
    // Update topic itself
    const updatedTopics = topics.map(t =>
      t.name === oldName ? { ...t, name: newName.trim() } : t
    )
    await window.electronAPI.updateMemoryTopics(updatedTopics)
    setEditingTopicName(null)
    await loadData()
  }

  const handleTopicDelete = async (topicName: string) => {
    // Remove topic from all memories
    const affectedMemories = memories.filter(m => m.topics.includes(topicName))
    for (const mem of affectedMemories) {
      const updatedTopics = mem.topics.filter(t => t !== topicName)
      await window.electronAPI.updateMemory(mem.id, { topics: updatedTopics })
    }
    // Remove topic from list
    const updatedTopics = topics.filter(t => t.name !== topicName)
    await window.electronAPI.updateMemoryTopics(updatedTopics)
    setMergeSelections(prev => { const next = new Set(prev); next.delete(topicName); return next })
    await loadData()
  }

  const handleTopicRecolor = async (topicName: string) => {
    const topic = topics.find(t => t.name === topicName)
    if (!topic) return
    const currentIdx = TOPIC_PRESET_COLORS.indexOf(topic.color)
    const nextColor = TOPIC_PRESET_COLORS[(currentIdx + 1) % TOPIC_PRESET_COLORS.length]
    const updatedTopics = topics.map(t =>
      t.name === topicName ? { ...t, color: nextColor } : t
    )
    await window.electronAPI.updateMemoryTopics(updatedTopics)
    await loadData()
  }

  const handleTopicMerge = async () => {
    const selected = Array.from(mergeSelections)
    if (selected.length < 2) return
    const targetName = selected[0]
    const toMerge = selected.slice(1)

    // Update all memories referencing merged topics
    for (const mem of memories) {
      const hasTarget = mem.topics.includes(targetName)
      const hasMerged = mem.topics.some(t => toMerge.includes(t))
      if (hasMerged) {
        let updatedTopics = mem.topics.filter(t => !toMerge.includes(t))
        if (!hasTarget) updatedTopics = [targetName, ...updatedTopics]
        await window.electronAPI.updateMemory(mem.id, { topics: updatedTopics })
      }
    }

    // Remove merged topics
    const updatedTopics = topics.filter(t => !toMerge.includes(t.name))
    await window.electronAPI.updateMemoryTopics(updatedTopics)
    setMergeSelections(new Set())
    await loadData()
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-purple/30 to-accent-blue/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-display font-semibold text-white/90">Memory Bank</h2>
            <p className="text-[10px] text-muted">{memories.length} memories · {topics.length} topics</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* View mode toggle */}
          <div className="flex bg-surface-2 rounded-lg p-0.5">
            {(['cards', 'timeline', 'graph'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                  viewMode === mode ? 'bg-surface-4 text-white' : 'text-muted hover:text-white/60'
                }`}
              >
                {mode === 'cards' ? '▦' : mode === 'timeline' ? '⏱' : '◉'} {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={handleExtractFromChat}
            disabled={extracting}
            className="px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-[10px] font-medium text-muted hover:text-white transition-all disabled:opacity-50"
          >
            {extracting ? 'Scanning...' : 'Scan All'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-muted hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); setFormTitle(''); setFormContent(''); setFormTopics(''); setFormImportance(2) }}
            className="px-2.5 py-1.5 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 text-[10px] font-medium text-accent-purple transition-all"
          >
            + Add Memory
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && settings && (
        <div className="mb-4 p-3 bg-surface-2 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-white/80">Memory Settings</span>
            <button onClick={() => setShowSettings(false)} className="text-muted hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-[10px] text-white/70">
              <input
                type="checkbox"
                checked={settings.autoGenerate}
                onChange={e => handleSaveSettings({ autoGenerate: e.target.checked })}
                className="rounded bg-surface-3 border-white/10"
              />
              Auto-generate memories
            </label>
            <label className="text-[10px] text-white/70">
              Max in context:
              <input
                type="number"
                value={settings.maxMemoriesInContext}
                onChange={e => handleSaveSettings({ maxMemoriesInContext: parseInt(e.target.value) || 5 })}
                className="ml-1 w-12 bg-surface-3 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 outline-none"
              />
            </label>
            <label className="text-[10px] text-white/70">
              Token budget:
              <input
                type="number"
                value={settings.tokenBudget}
                onChange={e => handleSaveSettings({ tokenBudget: parseInt(e.target.value) || 800 })}
                className="ml-1 w-16 bg-surface-3 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 outline-none"
              />
            </label>
          </div>
        </div>
      )}

      {/* Topic Manager */}
      {showTopicManager && (
        <div className="mb-4 p-3 bg-surface-2 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-white/80">Manage Topics</span>
            <button onClick={() => { setShowTopicManager(false); setMergeSelections(new Set()) }} className="text-muted hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {topics.length === 0 ? (
            <p className="text-[10px] text-muted/60">No topics yet. Topics are created automatically when memories are added.</p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {topics.map(t => (
                  <div key={t.name} className="flex items-center gap-2 group">
                    {/* Merge checkbox */}
                    <input
                      type="checkbox"
                      checked={mergeSelections.has(t.name)}
                      onChange={e => {
                        setMergeSelections(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(t.name)
                          else next.delete(t.name)
                          return next
                        })
                      }}
                      className="w-3 h-3 rounded bg-surface-3 border-white/10"
                    />
                    {/* Color swatch */}
                    <button
                      onClick={() => handleTopicRecolor(t.name)}
                      className="w-4 h-4 rounded-full shrink-0 border border-white/10 hover:border-white/30 transition-all"
                      style={{ backgroundColor: t.color }}
                      title="Click to change color"
                    />
                    {/* Name */}
                    {editingTopicName === t.name ? (
                      <input
                        autoFocus
                        value={topicRenameValue}
                        onChange={e => setTopicRenameValue(e.target.value)}
                        onBlur={() => handleTopicRename(t.name, topicRenameValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleTopicRename(t.name, topicRenameValue)
                          if (e.key === 'Escape') setEditingTopicName(null)
                        }}
                        className="flex-1 bg-surface-3 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingTopicName(t.name); setTopicRenameValue(t.name) }}
                        className="flex-1 text-left text-[10px] text-white/80 hover:text-white truncate"
                        title="Click to rename"
                      >
                        {t.name}
                      </button>
                    )}
                    {/* Memory count badge */}
                    <span className="px-1.5 py-0.5 rounded-md bg-surface-3 text-[8px] text-muted font-medium shrink-0">
                      {t.memoryCount}
                    </span>
                    {/* Delete */}
                    <button
                      onClick={() => handleTopicDelete(t.name)}
                      className="p-0.5 rounded hover:bg-surface-4 text-muted/50 hover:text-accent-red opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete topic"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Merge action */}
              {mergeSelections.size >= 2 && (
                <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-2">
                  <span className="text-[9px] text-muted">
                    Merge {mergeSelections.size} topics into "{Array.from(mergeSelections)[0]}"
                  </span>
                  <button
                    onClick={handleTopicMerge}
                    className="px-2 py-1 rounded-md bg-accent-purple/20 hover:bg-accent-purple/30 text-[9px] font-medium text-accent-purple transition-all"
                  >
                    Merge
                  </button>
                  <button
                    onClick={() => setMergeSelections(new Set())}
                    className="px-2 py-1 rounded-md bg-surface-3 hover:bg-surface-4 text-[9px] text-muted hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add/Edit form */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-surface-2 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-white/80">{editingId ? 'Edit Memory' : 'New Memory'}</span>
            <button onClick={() => { setShowAddForm(false); setEditingId(null) }} className="text-muted hover:text-white">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Memory title..."
            className="w-full bg-surface-3 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-purple/40 mb-2"
          />
          <textarea
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            placeholder="What should be remembered..."
            rows={3}
            className="w-full bg-surface-3 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-purple/40 mb-2 resize-none"
          />
          <div className="flex gap-2 items-center">
            <input
              value={formTopics}
              onChange={e => setFormTopics(e.target.value)}
              placeholder="Topics (comma-separated)..."
              className="flex-1 bg-surface-3 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-purple/40"
            />
            <div className="flex gap-1 items-center">
              <span className="text-[9px] text-muted">Importance:</span>
              {([1, 2, 3] as const).map(i => (
                <button
                  key={i}
                  onClick={() => setFormImportance(i)}
                  className={`w-5 h-5 rounded-full text-[9px] font-bold transition-all ${
                    formImportance === i ? 'bg-accent-purple text-white' : 'bg-surface-3 text-muted hover:text-white'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <button
              onClick={editingId ? handleSaveEdit : handleAdd}
              disabled={!formTitle.trim()}
              className="px-3 py-1.5 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 text-[10px] font-medium text-accent-purple transition-all disabled:opacity-30"
            >
              {editingId ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Context Files Section */}
      <div className="mb-4 p-3 bg-surface-2 rounded-xl border border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-[11px] font-medium text-white/80">Context Files</span>
            <span className="px-1.5 py-0.5 rounded-md bg-surface-3 text-[8px] text-muted font-medium">{contextFiles.length}</span>
            <span className="text-[9px] text-muted/50">~/.claude/memory/</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setShowContextForm(true)
                setEditingContextFile(null)
                setCtxFileName('')
                setCtxFileContent('')
              }}
              className="px-2 py-1 rounded-md bg-accent-blue/15 hover:bg-accent-blue/25 text-[9px] font-medium text-accent-blue transition-all"
            >
              + New File
            </button>
            {contextFiles.length > 0 && (
              <button
                onClick={() => window.electronAPI.openExternal('file://' + (contextFiles[0]?.path ? contextFiles[0].path.replace(/[/\\][^/\\]+$/, '') : ''))}
                className="px-2 py-1 rounded-md bg-surface-3 hover:bg-surface-4 text-[9px] text-muted hover:text-white transition-all"
              >
                Open Folder
              </button>
            )}
          </div>
        </div>

        {/* Create/Edit form */}
        {showContextForm && (
          <div className="mb-2 p-2.5 rounded-lg border border-accent-blue/20 bg-surface-1/40 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/70 flex-shrink-0">Filename:</span>
              <input
                value={ctxFileName}
                onChange={e => setCtxFileName(e.target.value)}
                placeholder="my-notes.md"
                disabled={!!editingContextFile}
                className="flex-1 bg-surface-3 border border-white/[0.06] rounded-md px-2 py-1 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-blue/40 disabled:opacity-50"
              />
            </div>
            <textarea
              value={ctxFileContent}
              onChange={e => setCtxFileContent(e.target.value)}
              placeholder="Write your context notes here... Markdown supported."
              rows={6}
              className="w-full bg-surface-3 border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-blue/40 resize-none font-mono"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowContextForm(false); setEditingContextFile(null) }}
                className="px-2.5 py-1 rounded-md bg-surface-3 hover:bg-surface-4 text-[9px] text-muted hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const name = ctxFileName.trim()
                  if (!name) return
                  await window.electronAPI.saveContextFile(name, ctxFileContent)
                  setShowContextForm(false)
                  setEditingContextFile(null)
                  setCtxFileName('')
                  setCtxFileContent('')
                  await loadData()
                }}
                disabled={!ctxFileName.trim()}
                className="px-2.5 py-1 rounded-md bg-accent-blue/20 hover:bg-accent-blue/30 text-[9px] font-medium text-accent-blue transition-all disabled:opacity-30"
              >
                {editingContextFile ? 'Save Changes' : 'Create File'}
              </button>
            </div>
          </div>
        )}

        {/* File list */}
        {contextFiles.length > 0 ? (
          <div className="space-y-1">
            {contextFiles.map(file => {
              const isExpanded = expandedFile === file.name
              const preview = file.content.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').slice(0, 120)
              const isDeleting = deletingContextFile === file.name
              return (
                <div key={file.name} className="rounded-lg border border-white/[0.04] bg-surface-1/30 overflow-hidden group/file">
                  <div
                    onClick={() => setExpandedFile(isExpanded ? null : file.name)}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-2/60 transition-all"
                  >
                    <span className="text-[11px] font-medium text-white/80 flex-shrink-0">{file.name}</span>
                    <span className="text-[9px] text-muted/50 truncate flex-1">{!isExpanded && preview}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setEditingContextFile(file.name)
                          setCtxFileName(file.name)
                          setCtxFileContent(file.content)
                          setShowContextForm(true)
                        }}
                        className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
                        title="Edit"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={async e => {
                          e.stopPropagation()
                          if (isDeleting) {
                            await window.electronAPI.deleteContextFile(file.name)
                            setDeletingContextFile(null)
                            if (expandedFile === file.name) setExpandedFile(null)
                            await loadData()
                          } else {
                            setDeletingContextFile(file.name)
                            setTimeout(() => setDeletingContextFile(null), 3000)
                          }
                        }}
                        className={`p-1 rounded transition-all ${isDeleting ? 'bg-accent-red/15 text-accent-red' : 'hover:bg-surface-3 text-muted hover:text-accent-red'}`}
                        title={isDeleting ? 'Click again to confirm' : 'Delete'}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <span className="text-[9px] text-muted/40 flex-shrink-0">
                      {new Date(file.modifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <svg className={`w-3 h-3 text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] px-4 py-3 max-h-64 overflow-auto">
                      <pre className="text-[10px] text-white/70 whitespace-pre-wrap leading-relaxed font-mono">{file.content}</pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : !showContextForm ? (
          <p className="text-[10px] text-muted/50 text-center py-2">No context files yet. Click "+ New File" to create one.</p>
        ) : null}
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 items-center mb-3">
        <div className="flex-1 relative">
          <svg className="w-3 h-3 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-white/90 placeholder-muted/40 outline-none focus:border-accent-purple/40"
          />
        </div>

        {/* Source filter pills */}
        <div className="flex gap-1">
          {(['all', 'chat', 'cli_session', 'journal', 'task', 'manual'] as SourceFilter[]).map(src => (
            <button
              key={src}
              onClick={() => setSourceFilter(src)}
              className={`px-2 py-1 rounded-md text-[9px] font-medium transition-all ${
                sourceFilter === src ? 'bg-surface-4 text-white' : 'bg-surface-2 text-muted hover:text-white/60'
              }`}
            >
              {src === 'all' ? 'All' : src === 'cli_session' ? 'CLI' : src.charAt(0).toUpperCase() + src.slice(1)}
            </button>
          ))}
        </div>

        {/* Topic filter */}
        {topics.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={topicFilter || ''}
              onChange={e => setTopicFilter(e.target.value || null)}
              className="bg-surface-2 border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-white/80 outline-none cursor-pointer [&>option]:bg-surface-2"
            >
              <option value="">All topics</option>
              {topics.map(t => (
                <option key={t.name} value={t.name}>{t.name} ({t.memoryCount})</option>
              ))}
            </select>
            <button
              onClick={() => setShowTopicManager(!showTopicManager)}
              className="text-[9px] text-accent-purple/60 hover:text-accent-purple transition-all whitespace-nowrap"
            >
              Manage
            </button>
          </div>
        )}

        {/* Sort */}
        <button
          onClick={() => setSortMode(sortMode === 'newest' ? 'importance' : 'newest')}
          className="px-2 py-1.5 rounded-lg bg-surface-2 text-[9px] text-muted hover:text-white transition-all"
          title={`Sort by ${sortMode === 'newest' ? 'importance' : 'newest'}`}
        >
          {sortMode === 'newest' ? '🕐 New' : '⭐ Imp'}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {memories.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-blue/20 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-accent-purple/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-white/80 mb-1">No memories yet</h3>
            <p className="text-[11px] text-muted mb-3 max-w-[300px]">
              Memories capture knowledge from your chats, CLI sessions, journal, and tasks. Add one manually or scan your data to get started.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddForm(true); setEditingId(null) }}
                className="px-3 py-1.5 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 text-[10px] font-medium text-accent-purple transition-all"
              >
                + Add Memory
              </button>
              <button
                onClick={handleExtractFromChat}
                disabled={extracting}
                className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] font-medium text-muted hover:text-white transition-all disabled:opacity-50"
              >
                {extracting ? 'Scanning...' : 'Scan All Sources'}
              </button>
            </div>
          </div>
        ) : viewMode === 'timeline' ? (
          <MemoryTimeline memories={filtered} onEdit={handleEdit} onDelete={handleDelete} onPin={handlePin} />
        ) : viewMode === 'graph' ? (
          <MemoryGraph memories={filtered} topics={topics} onSelectMemory={handleEdit} />
        ) : (
          /* Card grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filtered.map(mem => {
              const isExpanded = expandedId === mem.id
              return (
                <div
                  key={mem.id}
                  onClick={() => setExpandedId(isExpanded ? null : mem.id)}
                  className={`group bg-surface-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer relative ${
                    isExpanded
                      ? 'border-accent-purple/20 bg-surface-2/90'
                      : 'border-white/[0.04] hover:border-accent-purple/20'
                  }`}
                >
                  {/* Pin indicator */}
                  {mem.isPinned && (
                    <div className="absolute top-2 right-2 text-[10px] text-accent-purple">📌</div>
                  )}

                  {/* Header */}
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="text-sm shrink-0">{SOURCE_ICONS[mem.sourceType] || '📎'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[11px] font-medium text-white/90 truncate pr-4">{mem.title}</h3>
                    </div>
                    <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${IMPORTANCE_COLORS[mem.importance]}`} title={`Importance: ${mem.importance}`} />
                  </div>

                  {/* Content — expanded shows full, collapsed shows 2-line clamp */}
                  <p className={`text-[10px] text-muted leading-relaxed mb-2 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {mem.content}
                  </p>

                  {/* Topics */}
                  {mem.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {mem.topics.map(t => {
                        const topic = topics.find(tp => tp.name === t)
                        return (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded-md text-[8px] font-medium"
                            style={{
                              backgroundColor: (topic?.color || '#a78bfa') + '20',
                              color: topic?.color || '#a78bfa'
                            }}
                          >
                            {t}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mb-2 pt-1 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2 text-[9px] text-muted/60 mb-1.5">
                        <span>{mem.sourceType === 'cli_session' ? 'CLI Session' : mem.sourceType.charAt(0).toUpperCase() + mem.sourceType.slice(1)}</span>
                        <span>·</span>
                        <span>{new Date(mem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>·</span>
                        <span>{IMPORTANCE_LABELS[mem.importance]} importance</span>
                      </div>
                      {mem.relatedMemoryIds.length > 0 && (
                        <div className="mb-1.5">
                          <span className="text-[8px] text-muted/50 uppercase tracking-wider">Related</span>
                          {mem.relatedMemoryIds.map(rid => {
                            const rel = memories.find(m => m.id === rid)
                            return rel ? (
                              <div key={rid} className="text-[9px] text-accent-blue/60 truncate">{rel.title}</div>
                            ) : null
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer with action buttons */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted/50">
                      {new Date(mem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <div className={`flex gap-0.5 ${isExpanded ? '' : 'hidden group-hover:flex'}`}>
                      <button onClick={e => { e.stopPropagation(); handlePin(mem.id) }} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-accent-purple transition-all" title="Pin">
                        <svg className="w-2.5 h-2.5" fill={mem.isPinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleEdit(mem.id) }} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all" title="Edit">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleArchive(mem.id) }} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all" title="Archive">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(mem.id) }} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-accent-red transition-all" title="Delete">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
