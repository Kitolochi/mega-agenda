import { useState, useEffect, useCallback } from 'react'
import { RSSFeed } from '../types'

const SECTIONS = [
  { id: 'ai', name: 'AI & LLMs', icon: '🤖' },
  { id: 'geo', name: 'World', icon: '🌍' },
]

const SUGGESTED_FEEDS: Record<string, RSSFeed[]> = {
  ai: [
    { url: 'https://raw.githubusercontent.com/conoro/anthropic-engineering-rss-feed/main/anthropic_engineering_rss.xml', name: 'Anthropic Blog', category: 'ai' },
    { url: 'https://openai.com/news/rss.xml', name: 'OpenAI News', category: 'ai' },
    { url: 'https://deepmind.google/blog/rss.xml', name: 'Google DeepMind', category: 'ai' },
    { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI Blog', category: 'ai' },
    { url: 'https://karpathy.bearblog.dev/feed/', name: 'Karpathy Blog', category: 'ai' },
    { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXUPKJO5MZQN11PqgIvyuvQ', name: 'Karpathy YouTube', category: 'ai' },
    { url: 'https://simonwillison.net/atom/everything/', name: 'Simon Willison', category: 'ai' },
    { url: 'https://www.latent.space/feed', name: 'Latent Space', category: 'ai' },
    { url: 'https://magazine.sebastianraschka.com/feed', name: 'Ahead of AI', category: 'ai' },
    { url: 'https://www.interconnects.ai/feed', name: 'Interconnects', category: 'ai' },
    { url: 'https://jack-clark.net/feed/', name: 'Import AI', category: 'ai' },
    { url: 'https://lilianweng.github.io/index.xml', name: 'Lilian Weng', category: 'ai' },
    { url: 'https://news.smol.ai/rss.xml', name: 'AI News Daily', category: 'ai' },
    { url: 'https://papers.takara.ai/api/feed', name: 'HF Daily Papers', category: 'ai' },
    { url: 'https://rss.arxiv.org/rss/cs.AI', name: 'arXiv cs.AI', category: 'ai' },
    { url: 'https://bair.berkeley.edu/blog/feed.xml', name: 'BAIR Blog', category: 'ai' },
    { url: 'https://github.blog/ai-and-ml/feed/', name: 'GitHub AI & ML', category: 'ai' },
    { url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face', category: 'ai' },
    { url: 'https://www.reddit.com/r/ClaudeAI/.rss', name: 'r/ClaudeAI', category: 'ai' },
    { url: 'https://www.reddit.com/r/LocalLLaMA/.rss', name: 'r/LocalLLaMA', category: 'ai' },
    { url: 'https://www.reddit.com/r/MachineLearning/.rss', name: 'r/MachineLearning', category: 'ai' },
    { url: 'https://www.reddit.com/r/artificial/.rss', name: 'r/artificial', category: 'ai' },
    { url: 'https://hnrss.org/newest?q=Claude+Code+OR+Anthropic+OR+AI+coding&points=20', name: 'HN: AI Coding', category: 'ai' },
  ],
  geo: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World', category: 'geo' },
    { url: 'https://www.reddit.com/r/worldnews/.rss', name: 'r/worldnews', category: 'geo' },
    { url: 'https://feeds.npr.org/1004/rss.xml', name: 'NPR World', category: 'geo' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World', category: 'geo' },
  ],
}

const SHORTCUTS = [
  { key: 'N', label: 'New task' },
  { key: 'D', label: 'Dashboard' },
  { key: 'T', label: 'Tasks' },
  { key: 'L', label: 'List' },
  { key: 'J', label: 'Journal' },
  { key: 'F', label: 'Feed' },
  { key: 'S', label: 'Settings' },
  { key: 'V', label: 'Voice' },
  { key: '1-7', label: 'Select category' },
  { key: 'Esc', label: 'Back / Close' },
]

export default function Settings() {
  const [apiKey, setApiKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [keyVerifying, setKeyVerifying] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [feeds, setFeeds] = useState<RSSFeed[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('ai')

  const loadData = useCallback(async () => {
    const [key, saved] = await Promise.all([
      window.electronAPI.getClaudeApiKey(),
      window.electronAPI.getRSSFeeds()
    ])
    setApiKey(key)
    setFeeds(saved)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return
    setKeyVerifying(true)
    setKeyError(null)
    const result = await window.electronAPI.verifyClaudeKey(keyInput.trim())
    if (result.valid) {
      await window.electronAPI.saveClaudeApiKey(keyInput.trim())
      setApiKey(keyInput.trim())
      setKeyError(null)
    } else {
      setKeyError(result.error || 'Invalid key')
    }
    setKeyVerifying(false)
  }

  const handleRemoveKey = () => {
    setApiKey('')
    window.electronAPI.saveClaudeApiKey('')
    setKeyInput('')
  }

  const handleAddFeed = async (feed: RSSFeed) => {
    const updated = await window.electronAPI.addRSSFeed(feed.url, feed.name, feed.category)
    setFeeds(updated)
  }

  const handleRemoveFeed = async (url: string) => {
    const updated = await window.electronAPI.removeRSSFeed(url)
    setFeeds(updated)
  }

  const handleAddCustom = async () => {
    if (!newUrl.trim() || !newName.trim()) return
    await handleAddFeed({ url: newUrl.trim(), name: newName.trim(), category: newCategory })
    setNewUrl('')
    setNewName('')
  }

  const inputClass = "w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 focus:bg-surface-3 transition-all placeholder-muted/50"

  return (
    <div className="h-full overflow-auto p-5 animate-fade-in">
      <div className="text-center mb-5">
        <h2 className="font-display font-semibold text-sm text-white/90">Settings</h2>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="mb-6">
        <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Keyboard Shortcuts</label>
        <div className="glass-card rounded-xl p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="min-w-[28px] px-1.5 py-0.5 rounded-md bg-surface-3 border border-white/[0.06] text-white/50 font-mono text-[10px] text-center">
                  {s.key}
                </kbd>
                <span className="text-[11px] text-white/60">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Claude API Key */}
      <div className="mb-6">
        <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Claude API Key</label>
        {apiKey ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass-card">
            <svg className="w-3.5 h-3.5 text-accent-emerald shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[11px] text-white/60 flex-1">Key saved</span>
            <button onClick={handleRemoveKey} className="text-[10px] text-muted hover:text-accent-red transition-colors">Remove</button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className={inputClass}
            />
            {keyError && <p className="text-[10px] text-accent-red">{keyError}</p>}
            <button onClick={handleSaveKey} disabled={!keyInput.trim() || keyVerifying} className="w-full py-2 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-xs text-accent-blue font-medium transition-all">
              {keyVerifying ? 'Verifying...' : 'Save Key'}
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted/50 mt-1.5">Used for feed summaries and voice commands</p>
      </div>

      {/* Feed Sources */}
      <div className="mb-6">
        <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Feed Sources</label>

        {SECTIONS.map(section => {
          const sectionFeeds = feeds.filter(f => f.category === section.id)
          const suggested = SUGGESTED_FEEDS[section.id]?.filter(s => !feeds.find(f => f.url === s.url)) || []
          return (
            <div key={section.id} className="mb-4">
              <div className="text-[11px] text-white/70 font-medium mb-1.5">{section.icon} {section.name}</div>
              {sectionFeeds.length > 0 && (
                <div className="space-y-1 mb-2">
                  {sectionFeeds.map(f => (
                    <div key={f.url} className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card">
                      <span className="text-[11px] text-white/80 flex-1 truncate">{f.name}</span>
                      <button onClick={() => handleRemoveFeed(f.url)} className="text-muted hover:text-accent-red transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {suggested.length > 0 && (
                <div className="space-y-1">
                  {suggested.map(s => (
                    <button key={s.url} onClick={() => handleAddFeed(s)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-left transition-all">
                      <svg className="w-3 h-3 text-accent-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      <span className="text-[11px] text-white/70">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Custom feed */}
        <div className="mt-3">
          <div className="text-[11px] text-white/70 font-medium mb-1.5">Add Custom Feed</div>
          <div className="space-y-1.5">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Feed name" className={inputClass} />
            <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://example.com/feed.xml" className={inputClass} />
            <div className="flex gap-2">
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setNewCategory(s.id)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${newCategory === s.id ? 'bg-surface-4 text-white' : 'bg-surface-2 text-muted hover:text-white/60'}`}>
                  {s.icon} {s.name}
                </button>
              ))}
            </div>
            <button onClick={handleAddCustom} disabled={!newUrl.trim() || !newName.trim()} className="w-full py-2 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-xs text-accent-blue font-medium transition-all">
              Add Feed
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
