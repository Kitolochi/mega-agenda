import { useState, useEffect, useCallback } from 'react'
import { RSSFeed, FeedItem } from '../types'

const SECTIONS = [
  { id: 'ai', name: 'AI & LLMs', icon: '🤖' },
  { id: 'geo', name: 'World', icon: '🌍' },
]

const AI_KEYWORDS = /\b(ai|artificial intelligence|llm|gpt|claude|anthropic|openai|gemini|machine learning|deep learning|neural|transformer|chatbot|language model|diffusion|midjourney|dall-e|sora|copilot|llama|mistral|embedding|fine.?tun|prompt|rag|agi|inference|training data|benchmark|vision model|video model|image gen|stable diffusion|hugging\s?face|token|reasoning|multimodal|agent|agentic|retrieval|vector|lora|rlhf|alignment|safety|hallucin|context window|open.?source model|foundation model|generative|chatgpt|grok|perplexity|cursor|devin)\b/i

interface FeedProps {
  onOpenSettings: () => void
}

export default function Feed({ onOpenSettings }: FeedProps) {
  const [feeds, setFeeds] = useState<RSSFeed[]>([])
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [activeSection, setActiveSection] = useState('ai')
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    const [saved, key] = await Promise.all([
      window.electronAPI.getRSSFeeds(),
      window.electronAPI.getClaudeApiKey()
    ])
    setFeeds(saved)
    setApiKey(key)
    if (saved.length > 0) {
      fetchItems(saved)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const fetchItems = async (feedList: RSSFeed[]) => {
    setLoading(true)
    try {
      const data = await window.electronAPI.fetchRSSFeeds(feedList)
      setItems(data)
      setLastRefresh(new Date())
    } catch {}
    setLoading(false)
  }

  const handleRefresh = () => {
    if (feeds.length > 0) {
      setSummaries({})
      fetchItems(feeds)
    }
  }

  const handleSummarize = async (section: string) => {
    if (!apiKey) { setSummaryError('Set your Claude API key in Settings first'); return }
    let toSummarize = items.filter(i => {
      const feed = feeds.find(f => f.name === i.feedName)
      return feed?.category === section
    })
    if (section === 'ai') {
      toSummarize = toSummarize.filter(i => AI_KEYWORDS.test(`${i.title} ${i.description}`))
    }
    if (toSummarize.length === 0) { setSummaryError('No articles to summarize'); return }

    setSummarizing(section)
    setSummaryError(null)
    try {
      const result = await window.electronAPI.summarizeFeed(
        apiKey,
        toSummarize.map(i => ({ title: i.title, description: i.description })),
        section
      )
      setSummaries(prev => ({ ...prev, [section]: result }))
    } catch (err: any) {
      setSummaryError(err.message || 'Summarization failed')
    }
    setSummarizing(null)
  }

  const handleOpenLink = (url: string) => {
    if (url) window.electronAPI.openExternal(url)
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const sectionItems = items.filter(i => {
    const feed = feeds.find(f => f.name === i.feedName)
    if (feed?.category !== activeSection) return false
    if (activeSection === 'ai') {
      const text = `${i.title} ${i.description}`
      return AI_KEYWORDS.test(text)
    }
    return true
  })

  // No feeds configured — point to Settings
  if (feeds.length === 0 && !loading) {
    return (
      <div className="h-full flex items-center justify-center animate-fade-in">
        <div className="text-center px-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-surface-2 flex items-center justify-center">
            <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </div>
          <p className="text-sm text-white/60 mb-1">No feeds configured</p>
          <p className="text-[11px] text-muted mb-3">Add RSS sources to get started</p>
          <button onClick={onOpenSettings} className="px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 rounded-lg text-xs text-accent-blue font-medium transition-all">
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-2 pb-1 border-b border-white/[0.03]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  activeSection === s.id ? 'bg-surface-4 text-white' : 'text-muted hover:text-white/60'
                }`}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {lastRefresh && <span className="text-[9px] text-muted/40">{formatTime(lastRefresh.toISOString())}</span>}
            <button onClick={handleRefresh} disabled={loading} className={`w-6 h-6 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-muted hover:text-white transition-all ${loading ? 'animate-spin' : ''}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onOpenSettings} className="w-6 h-6 rounded-lg hover:bg-white/[0.04] flex items-center justify-center text-muted hover:text-white transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Summary section */}
        <div className="px-4 pt-3 pb-2">
          {summaries[activeSection] ? (
            <div className="glass-card rounded-xl p-3 mb-3 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-accent-purple font-display font-medium">Key Highlights</span>
                <button onClick={() => handleSummarize(activeSection)} className="text-[9px] text-muted hover:text-white/60 transition-colors">
                  {summarizing === activeSection ? 'Updating...' : 'Refresh'}
                </button>
              </div>
              <div className="text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap [&>p]:mb-1.5 summary-content">
                {summaries[activeSection].split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('**') || line.startsWith('- **') ? 'text-white/90 font-medium' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleSummarize(activeSection)}
              disabled={summarizing !== null || sectionItems.length === 0}
              className="w-full glass-card rounded-xl p-3 mb-3 flex items-center justify-center gap-2 hover:bg-white/[0.04] disabled:opacity-40 transition-all"
            >
              {summarizing === activeSection ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
                  <span className="text-[11px] text-accent-purple">Summarizing...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-[11px] text-accent-purple font-medium">
                    {apiKey ? 'Summarize with AI' : 'Set API key in Settings to summarize'}
                  </span>
                </>
              )}
            </button>
          )}
          {summaryError && (
            <p className="text-[10px] text-accent-red mb-2">{summaryError}</p>
          )}
        </div>

        {/* Loading */}
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-6 h-6 mx-auto mb-2 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
              <p className="text-[11px] text-muted">Loading feeds...</p>
            </div>
          </div>
        )}

        {/* Feed items */}
        <div className="px-4 pb-3 space-y-2">
          {sectionItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => handleOpenLink(item.link)}
              className="w-full text-left glass-card rounded-xl p-3 animate-slide-up hover:bg-white/[0.04] transition-all group"
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <h3 className="text-[12px] font-medium text-white/90 leading-snug mb-1 group-hover:text-accent-blue transition-colors">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-[11px] text-white/40 leading-relaxed mb-2 line-clamp-2">{item.description}</p>
              )}
              <div className="flex items-center gap-2">
                {item.author && <span className="text-[9px] text-muted/60 truncate max-w-[100px]">{item.author}</span>}
                {item.author && item.pubDate && <span className="text-[9px] text-muted/30">&middot;</span>}
                {item.pubDate && <span className="text-[9px] text-muted/50">{formatTime(item.pubDate)}</span>}
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-md bg-accent-orange/10 text-accent-orange/60 shrink-0">{item.feedName}</span>
              </div>
            </button>
          ))}
          {!loading && sectionItems.length === 0 && items.length > 0 && (
            <div className="text-center py-8">
              <p className="text-[11px] text-muted mb-2">No articles in this section</p>
              <button onClick={onOpenSettings} className="text-xs text-accent-blue hover:text-accent-blue/80">Manage feeds</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
