import { useState, useEffect, useCallback, useRef } from 'react'
import { TweetDraft, TweetAIMessage } from '../types'

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-surface-3 rounded-lg p-2.5 my-1.5 overflow-x-auto text-[11px] font-mono text-white/80"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-3 px-1 py-0.5 rounded text-[11px] font-mono text-accent-blue">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white/90">$1</strong>')
    .replace(/^\- (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-muted shrink-0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="ml-1">$&</div>')
    .replace(/\n/g, '<br/>')
}

function extractTweets(text: string): string[] {
  const tweets: string[] = []
  // Match text in backticks (single-line or multi-line)
  const backtickMatches = text.match(/`([^`]+)`/g)
  if (backtickMatches) {
    for (const match of backtickMatches) {
      const content = match.slice(1, -1).trim()
      if (content.length > 10 && content.length <= 280) {
        tweets.push(content)
      }
    }
  }
  // Also match text in double quotes that looks like a tweet (20-280 chars, starts with capital or emoji)
  const quoteMatches = text.match(/"([^"]{20,280})"/g)
  if (quoteMatches) {
    for (const match of quoteMatches) {
      const content = match.slice(1, -1).trim()
      if (!tweets.includes(content) && content.length <= 280) {
        tweets.push(content)
      }
    }
  }
  return tweets
}

export default function SocialTab() {
  const [drafts, setDrafts] = useState<TweetDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [showDraftList, setShowDraftList] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [freeformInput, setFreeformInput] = useState('')
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [topicInput, setTopicInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeDraft = drafts.find(d => d.id === activeDraftId) || null

  const loadDrafts = useCallback(async () => {
    const d = await window.electronAPI.getTweetDrafts()
    setDrafts(d)
  }, [])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  // When active draft changes, load its text
  useEffect(() => {
    if (activeDraft) {
      setText(activeDraft.text)
      setAiResponse('')
      setPostResult(null)
    }
  }, [activeDraftId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  const handleTextChange = useCallback((newText: string) => {
    setText(newText)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (activeDraftId) {
      const draftId = activeDraftId
      saveTimeoutRef.current = setTimeout(async () => {
        await window.electronAPI.updateTweetDraft(draftId, { text: newText })
      }, 500)
    }
  }, [activeDraftId])

  const handleNewDraft = async (topic?: string) => {
    const draft = await window.electronAPI.createTweetDraft(topic)
    await loadDrafts()
    setActiveDraftId(draft.id)
    setText('')
    setAiResponse('')
    setTopicInput('')
    setShowDraftList(false)
    textareaRef.current?.focus()
  }

  const handleDeleteDraft = async () => {
    if (!activeDraftId) return
    await window.electronAPI.deleteTweetDraft(activeDraftId)
    await loadDrafts()
    setActiveDraftId(null)
    setText('')
    setAiResponse('')
  }

  const handleSelectDraft = (id: string) => {
    setActiveDraftId(id)
    setShowDraftList(false)
  }

  const buildAIHistory = (): { role: string; content: string }[] => {
    if (!activeDraft) return []
    return activeDraft.aiHistory.map(m => ({
      role: m.role,
      content: m.content
    }))
  }

  const saveAIMessage = async (role: 'user' | 'assistant', type: TweetAIMessage['type'], content: string) => {
    if (!activeDraftId) return
    const msg: TweetAIMessage = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      role,
      type,
      content,
      timestamp: new Date().toISOString()
    }
    await window.electronAPI.addTweetAIMessage(activeDraftId, msg)
    await loadDrafts()
  }

  const handleBrainstorm = async () => {
    if (!activeDraftId || aiLoading) return
    const topic = activeDraft?.topic || text || topicInput
    if (!topic.trim()) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const userMsg = `Brainstorm tweets about: "${topic}"`
      await saveAIMessage('user', 'brainstorm', userMsg)
      const response = await window.electronAPI.tweetBrainstorm(topic, buildAIHistory())
      setAiResponse(response)
      await saveAIMessage('assistant', 'brainstorm', response)
      await window.electronAPI.updateTweetDraft(activeDraftId, { status: 'refining' })
      await loadDrafts()
    } catch (err: any) {
      setAiResponse(`Error: ${err.message || 'Failed to brainstorm'}`)
    }
    setAiLoading(false)
  }

  const handleRefine = async (instruction?: string) => {
    if (!activeDraftId || aiLoading || !text.trim()) return
    const refinementInstruction = instruction || 'Improve this tweet. Make it more engaging and punchy.'
    setAiLoading(true)
    setAiResponse('')
    try {
      const userMsg = `Refine: "${text}" — ${refinementInstruction}`
      await saveAIMessage('user', 'refine', userMsg)
      const response = await window.electronAPI.tweetRefine(text, refinementInstruction, buildAIHistory())
      setAiResponse(response)
      await saveAIMessage('assistant', 'refine', response)
      await window.electronAPI.updateTweetDraft(activeDraftId, { status: 'refining' })
      await loadDrafts()
    } catch (err: any) {
      setAiResponse(`Error: ${err.message || 'Failed to refine'}`)
    }
    setAiLoading(false)
  }

  const handleAnalyze = async () => {
    if (!activeDraftId || aiLoading || !text.trim()) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const userMsg = `Analyze: "${text}"`
      await saveAIMessage('user', 'analyze', userMsg)
      const response = await window.electronAPI.tweetAnalyze(text)
      setAiResponse(response)
      await saveAIMessage('assistant', 'analyze', response)
      await loadDrafts()
    } catch (err: any) {
      setAiResponse(`Error: ${err.message || 'Failed to analyze'}`)
    }
    setAiLoading(false)
  }

  const handleFreeform = async () => {
    if (!activeDraftId || aiLoading || !freeformInput.trim()) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const instruction = freeformInput.trim()
      setFreeformInput('')
      await saveAIMessage('user', 'freeform', instruction)
      const currentText = text.trim()
      const response = await window.electronAPI.tweetRefine(
        currentText || '(no draft yet)',
        instruction,
        buildAIHistory()
      )
      setAiResponse(response)
      await saveAIMessage('assistant', 'freeform', response)
      await loadDrafts()
    } catch (err: any) {
      setAiResponse(`Error: ${err.message || 'Failed'}`)
    }
    setAiLoading(false)
  }

  const handleUseTweet = async (tweetText: string) => {
    setText(tweetText)
    if (activeDraftId) {
      await window.electronAPI.updateTweetDraft(activeDraftId, { text: tweetText, status: 'ready' })
      await loadDrafts()
    }
  }

  const handlePost = async () => {
    if (!text.trim() || text.length > 280 || posting) return
    setPosting(true)
    setPostResult(null)
    const result = await window.electronAPI.postTweet(text.trim())
    setPostResult(result)
    if (result.success && activeDraftId) {
      await window.electronAPI.updateTweetDraft(activeDraftId, {
        status: 'posted',
        postedAt: new Date().toISOString(),
        tweetId: result.tweetId
      })
      await loadDrafts()
    }
    setPosting(false)
  }

  const handleCopy = () => {
    if (text.trim()) {
      window.electronAPI.writeClipboard(text.trim())
    }
  }

  const charCount = text.length
  const overLimit = charCount > 280

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-white/10 text-white/50',
      refining: 'bg-accent-amber/20 text-accent-amber',
      ready: 'bg-accent-emerald/20 text-accent-emerald',
      posted: 'bg-accent-blue/20 text-accent-blue'
    }
    return colors[status] || colors.draft
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <button
          onClick={() => setShowDraftList(!showDraftList)}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 transition-all text-left min-w-0"
        >
          <svg className="w-3 h-3 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-[11px] text-white/70 truncate">
            {activeDraft ? (activeDraft.topic || activeDraft.text.slice(0, 40) || 'Untitled draft') : 'Select a draft'}
          </span>
          {activeDraft && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(activeDraft.status)}`}>
              {activeDraft.status}
            </span>
          )}
        </button>
        <button
          onClick={() => handleNewDraft()}
          className="px-2.5 py-1.5 rounded-lg bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue text-[11px] font-medium transition-all shrink-0"
        >
          + New
        </button>
        {activeDraft && (
          <button
            onClick={handleDeleteDraft}
            className="w-7 h-7 rounded-lg hover:bg-accent-red/20 flex items-center justify-center text-muted hover:text-accent-red transition-all shrink-0"
            title="Delete draft"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Draft List Overlay */}
      {showDraftList && (
        <div className="absolute inset-0 z-30 bg-surface-0/95 backdrop-blur-sm flex flex-col animate-fade-in">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/[0.06]">
            <span className="text-xs font-display font-medium text-white/80">Drafts</span>
            <button
              onClick={() => setShowDraftList(false)}
              className="w-6 h-6 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white/60 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {drafts.length === 0 ? (
              <div className="text-center py-8 text-muted text-xs">No drafts yet</div>
            ) : (
              <div className="space-y-1">
                {drafts.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDraft(d.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      d.id === activeDraftId ? 'bg-accent-blue/10 border border-accent-blue/20' : 'hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-white/80 flex-1 truncate">
                        {d.topic || d.text.slice(0, 50) || 'Untitled'}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(d.status)}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {!activeDraft ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-muted" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <p className="text-sm text-white/70 font-medium mb-1">Social Media Manager</p>
            <p className="text-[11px] text-muted mb-4">Craft tweets with AI-powered rhetoric</p>
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && topicInput.trim()) handleNewDraft(topicInput.trim()) }}
                placeholder="What do you want to tweet about?"
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all placeholder-muted/50"
              />
              <button
                onClick={() => handleNewDraft(topicInput.trim() || undefined)}
                className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 rounded-lg text-xs text-white font-medium transition-all shrink-0"
              >
                Start
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Tweet Editor */}
            <div className="glass-card rounded-xl p-3">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => handleTextChange(e.target.value)}
                placeholder="Write your tweet..."
                rows={4}
                className="w-full bg-transparent border-none text-sm text-white/90 focus:outline-none resize-none placeholder-muted/50"
              />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono ${overLimit ? 'text-accent-red' : charCount > 250 ? 'text-accent-amber' : 'text-muted/60'}`}>
                    {charCount}/280
                  </span>
                  {charCount > 0 && (
                    <div className="w-16 h-1 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${overLimit ? 'bg-accent-red' : charCount > 250 ? 'bg-accent-amber' : 'bg-accent-blue'}`}
                        style={{ width: `${Math.min(100, (charCount / 280) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {postResult && (
                    <span className={`text-[10px] ${postResult.success ? 'text-accent-emerald' : 'text-accent-red'}`}>
                      {postResult.success ? 'Posted!' : postResult.error}
                    </span>
                  )}
                  <button
                    onClick={handleCopy}
                    disabled={!text.trim()}
                    className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 text-[10px] text-white/60 font-medium transition-all"
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handlePost}
                    disabled={!text.trim() || overLimit || posting || activeDraft.status === 'posted'}
                    className="px-3 py-1 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 rounded-lg text-[10px] text-white font-medium transition-all"
                  >
                    {posting ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : activeDraft.status === 'posted' ? 'Posted' : 'Post'}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={handleBrainstorm}
                disabled={aiLoading || (!text.trim() && !activeDraft.topic)}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">💡</span> Brainstorm
              </button>
              <button
                onClick={() => handleRefine()}
                disabled={aiLoading || !text.trim()}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">✨</span> Refine
              </button>
              <button
                onClick={handleAnalyze}
                disabled={aiLoading || !text.trim()}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">🎯</span> Analyze
              </button>
              <button
                onClick={() => handleRefine('Make it punchier and more concise. Remove filler words.')}
                disabled={aiLoading || !text.trim()}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">⚡</span> Punchier
              </button>
              <button
                onClick={() => handleRefine('Add a strong hook in the first line that makes people stop scrolling.')}
                disabled={aiLoading || !text.trim()}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">🪝</span> Add hook
              </button>
              <button
                onClick={() => handleRefine('Take a contrarian or surprising angle on this same topic.')}
                disabled={aiLoading || !text.trim()}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">🔄</span> Contrarian
              </button>
            </div>

            {/* AI Response Panel */}
            {(aiLoading || aiResponse) && (
              <div className="glass-card rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 rounded-full bg-accent-purple/20 flex items-center justify-center">
                    <span className="text-[8px]">✦</span>
                  </div>
                  <span className="text-[10px] text-muted uppercase tracking-wider font-display">Claude</span>
                  {aiLoading && (
                    <div className="w-3 h-3 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin ml-1" />
                  )}
                </div>
                {aiLoading ? (
                  <div className="text-[11px] text-muted animate-pulse">Thinking...</div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className="text-[12px] text-white/80 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(aiResponse) }}
                    />
                    {/* "Use this" buttons for extractable tweets */}
                    {extractTweets(aiResponse).length > 0 && (
                      <div className="space-y-1.5 mt-2 pt-2 border-t border-white/[0.04]">
                        {extractTweets(aiResponse).map((tweet, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-surface-2/50">
                            <p className="text-[11px] text-white/70 flex-1 leading-relaxed">{tweet}</p>
                            <button
                              onClick={() => handleUseTweet(tweet)}
                              className="px-2 py-1 rounded-md bg-accent-blue/20 hover:bg-accent-blue/30 text-[10px] text-accent-blue font-medium transition-all shrink-0"
                            >
                              Use this
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Freeform Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={freeformInput}
                onChange={e => setFreeformInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && freeformInput.trim()) handleFreeform() }}
                placeholder="Ask Claude anything about this tweet..."
                disabled={aiLoading}
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-accent-blue/40 transition-all placeholder-muted/50 disabled:opacity-50"
              />
              <button
                onClick={handleFreeform}
                disabled={aiLoading || !freeformInput.trim()}
                className="px-3 py-2 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 disabled:opacity-30 text-[11px] text-accent-purple font-medium transition-all shrink-0"
              >
                Ask
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
