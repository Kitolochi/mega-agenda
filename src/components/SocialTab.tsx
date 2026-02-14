import { useState, useEffect, useCallback, useRef } from 'react'
import { TweetDraft, TweetAIMessage, TweetPersona } from '../types'

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

const BUILT_IN_PERSONAS: TweetPersona[] = [
  {
    id: 'builtin-pg',
    name: 'Paul Graham',
    description: 'Pithy startup wisdom, first-principles reasoning, contrarian insights',
    exampleTweets: [
      'The best way to get startup ideas is not to try to think of startup ideas.',
      'Most people don\'t really want to start a startup. They want the idea of having started a startup.',
      'Writing is thinking. If you can\'t write clearly, you probably can\'t think clearly either.'
    ],
    isBuiltIn: true,
    createdAt: ''
  },
  {
    id: 'builtin-naval',
    name: 'Naval',
    description: 'Philosophical, aphoristic, wealth/leverage/happiness themes',
    exampleTweets: [
      'Seek wealth, not money or status. Wealth is having assets that earn while you sleep.',
      'The most important skill for getting rich is becoming a perpetual learner.',
      'A calm mind, a fit body, and a house full of love. These things cannot be bought.'
    ],
    isBuiltIn: true,
    createdAt: ''
  },
  {
    id: 'builtin-snarky',
    name: 'Snarky Critic',
    description: 'Sardonic commentary on tech hype, deflating buzzwords with wit',
    exampleTweets: [
      'Your AI startup is just if/else statements with a pitch deck.',
      'Web3 is just databases but everyone agreed to pretend they\'re worse.',
      '"We\'re disrupting the space" — the space was fine, you added a subscription fee.'
    ],
    isBuiltIn: true,
    createdAt: ''
  },
  {
    id: 'builtin-builder',
    name: 'Builder',
    description: 'Building in public, lessons learned, authentic vulnerability',
    exampleTweets: [
      'Day 47 of building my SaaS. Revenue: $0. Lessons learned: priceless. Here\'s what I wish I knew on day 1.',
      'Shipped a feature nobody asked for. Got 3x more signups than the one everyone demanded. Listen to behavior, not words.',
      'Failed publicly today. Lost a big customer. But I\'d rather build in the open than pretend everything\'s perfect.'
    ],
    isBuiltIn: true,
    createdAt: ''
  },
  {
    id: 'builtin-thought-leader',
    name: 'Thought Leader',
    description: 'Confident frameworks, numbered insights, bold predictions',
    exampleTweets: [
      'The 3 skills that will matter most in 2025: 1) Prompt engineering 2) Systems thinking 3) Emotional intelligence. Here\'s why.',
      'Hot take: Remote work isn\'t about location. It\'s about trust. Companies that get this will win the talent war.',
      'I\'ve interviewed 200+ founders. The #1 trait that separates winners from losers? Speed of execution.'
    ],
    isBuiltIn: true,
    createdAt: ''
  }
]

export default function SocialTab() {
  const [drafts, setDrafts] = useState<TweetDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [segments, setSegments] = useState<string[]>([''])
  const [isThread, setIsThread] = useState(false)
  const [showDraftList, setShowDraftList] = useState(false)
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [freeformInput, setFreeformInput] = useState('')
  const [posting, setPosting] = useState(false)
  const [postProgress, setPostProgress] = useState('')
  const [postResult, setPostResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [topicInput, setTopicInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persona state
  const [customPersonas, setCustomPersonas] = useState<TweetPersona[]>([])
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null)
  const [showPersonaForm, setShowPersonaForm] = useState(false)
  const [personaFormName, setPersonaFormName] = useState('')
  const [personaFormDesc, setPersonaFormDesc] = useState('')
  const [personaFormExamples, setPersonaFormExamples] = useState(['', ''])

  const allPersonas = [...BUILT_IN_PERSONAS, ...customPersonas]
  const activePersona = allPersonas.find(p => p.id === activePersonaId) || undefined
  const activeDraft = drafts.find(d => d.id === activeDraftId) || null

  const loadDrafts = useCallback(async () => {
    const d = await window.electronAPI.getTweetDrafts()
    setDrafts(d)
  }, [])

  const loadPersonas = useCallback(async () => {
    const p = await window.electronAPI.getTweetPersonas()
    setCustomPersonas(p)
  }, [])

  useEffect(() => {
    loadDrafts()
    loadPersonas()
  }, [loadDrafts, loadPersonas])

  // When active draft changes, load its state
  useEffect(() => {
    if (activeDraft) {
      setText(activeDraft.text)
      // Migration: if segments is missing, derive from text
      const seg = activeDraft.segments && activeDraft.segments.length > 0
        ? activeDraft.segments
        : (activeDraft.text ? [activeDraft.text] : [''])
      setSegments(seg)
      setIsThread(activeDraft.isThread || false)
      setAiResponse('')
      setPostResult(null)
      setPostProgress('')
    }
  }, [activeDraftId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save for single tweet
  const handleTextChange = useCallback((newText: string) => {
    setText(newText)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (activeDraftId) {
      const draftId = activeDraftId
      saveTimeoutRef.current = setTimeout(async () => {
        await window.electronAPI.updateTweetDraft(draftId, { text: newText, segments: [newText] })
      }, 500)
    }
  }, [activeDraftId])

  // Debounced auto-save for thread segments
  const handleSegmentChange = useCallback((index: number, value: string) => {
    setSegments(prev => {
      const updated = [...prev]
      updated[index] = value
      // Also keep text in sync (first segment for backward compat)
      if (index === 0) setText(value)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (activeDraftId) {
        const draftId = activeDraftId
        saveTimeoutRef.current = setTimeout(async () => {
          await window.electronAPI.updateTweetDraft(draftId, { segments: updated, text: updated[0] || '' })
        }, 500)
      }
      return updated
    })
  }, [activeDraftId])

  const addSegment = () => {
    setSegments(prev => {
      const updated = [...prev, '']
      if (activeDraftId) {
        window.electronAPI.updateTweetDraft(activeDraftId, { segments: updated })
      }
      return updated
    })
  }

  const removeSegment = (index: number) => {
    if (segments.length <= 1) return
    setSegments(prev => {
      const updated = prev.filter((_, i) => i !== index)
      if (activeDraftId) {
        window.electronAPI.updateTweetDraft(activeDraftId, { segments: updated, text: updated[0] || '' })
      }
      if (index === 0) setText(updated[0] || '')
      return updated
    })
  }

  const toggleThread = async () => {
    const newIsThread = !isThread
    setIsThread(newIsThread)
    if (activeDraftId) {
      if (newIsThread && segments.length === 1 && !segments[0]) {
        // Starting fresh thread — keep single empty segment
      }
      await window.electronAPI.updateTweetDraft(activeDraftId, { isThread: newIsThread })
      await loadDrafts()
    }
  }

  const handleNewDraft = async (topic?: string) => {
    const draft = await window.electronAPI.createTweetDraft(topic)
    await loadDrafts()
    setActiveDraftId(draft.id)
    setText('')
    setSegments([''])
    setIsThread(false)
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
    setSegments([''])
    setIsThread(false)
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
      const userMsg = isThread
        ? `Brainstorm thread about: "${topic}"`
        : `Brainstorm tweets about: "${topic}"`
      await saveAIMessage('user', 'brainstorm', userMsg)
      const response = isThread
        ? await window.electronAPI.tweetBrainstormThread(topic, buildAIHistory(), activePersona)
        : await window.electronAPI.tweetBrainstorm(topic, buildAIHistory(), activePersona)
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
    if (!activeDraftId || aiLoading) return
    const currentText = isThread ? segments.join('\n\n---\n\n') : text
    if (!currentText.trim()) return
    const refinementInstruction = instruction || (isThread
      ? 'Improve this thread. Make each tweet more engaging while maintaining narrative flow.'
      : 'Improve this tweet. Make it more engaging and punchy.')
    setAiLoading(true)
    setAiResponse('')
    try {
      const userMsg = `Refine: "${currentText}" — ${refinementInstruction}`
      await saveAIMessage('user', 'refine', userMsg)
      const response = await window.electronAPI.tweetRefine(currentText, refinementInstruction, buildAIHistory(), activePersona)
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
    if (!activeDraftId || aiLoading) return
    const currentText = isThread ? segments.join('\n\n---\n\n') : text
    if (!currentText.trim()) return
    setAiLoading(true)
    setAiResponse('')
    try {
      const userMsg = `Analyze: "${currentText}"`
      await saveAIMessage('user', 'analyze', userMsg)
      const response = await window.electronAPI.tweetAnalyze(currentText)
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
      const currentText = isThread ? segments.join('\n\n---\n\n') : text
      const response = await window.electronAPI.tweetRefine(
        currentText || '(no draft yet)',
        instruction,
        buildAIHistory(),
        activePersona
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
    if (isThread) {
      // For threads, extract all tweets from AI response and fill segments
      const extracted = extractTweets(aiResponse)
      if (extracted.length > 1) {
        setSegments(extracted)
        setText(extracted[0])
        if (activeDraftId) {
          await window.electronAPI.updateTweetDraft(activeDraftId, {
            segments: extracted,
            text: extracted[0],
            status: 'ready'
          })
          await loadDrafts()
        }
        return
      }
    }
    // Single tweet use
    setText(tweetText)
    if (activeDraftId) {
      await window.electronAPI.updateTweetDraft(activeDraftId, { text: tweetText, segments: [tweetText], status: 'ready' })
      await loadDrafts()
    }
  }

  // Thread-aware "Use all" that fills all segments at once
  const handleUseAllTweets = async () => {
    const extracted = extractTweets(aiResponse)
    if (extracted.length === 0) return
    if (isThread) {
      setSegments(extracted)
      setText(extracted[0])
      if (activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, {
          segments: extracted,
          text: extracted[0],
          status: 'ready'
        })
        await loadDrafts()
      }
    } else {
      // Single mode: use the first one
      setText(extracted[0])
      if (activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, { text: extracted[0], segments: [extracted[0]], status: 'ready' })
        await loadDrafts()
      }
    }
  }

  const handlePost = async () => {
    if (posting) return
    if (isThread) {
      // Post thread sequentially
      const validSegments = segments.filter(s => s.trim())
      if (validSegments.length === 0 || validSegments.some(s => s.length > 280)) return
      setPosting(true)
      setPostResult(null)
      setPostProgress(`Posting 1/${validSegments.length}...`)
      const tweetIds: string[] = []
      let lastTweetId: string | undefined

      for (let i = 0; i < validSegments.length; i++) {
        setPostProgress(`Posting ${i + 1}/${validSegments.length}...`)
        const result = await window.electronAPI.postTweet(validSegments[i].trim(), lastTweetId)
        if (!result.success) {
          setPostResult({ success: false, error: `Failed at tweet ${i + 1}: ${result.error}` })
          setPosting(false)
          setPostProgress('')
          return
        }
        tweetIds.push(result.tweetId!)
        lastTweetId = result.tweetId
      }

      setPostResult({ success: true })
      setPostProgress('')
      if (activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, {
          status: 'posted',
          postedAt: new Date().toISOString(),
          tweetId: tweetIds[0],
          threadTweetIds: tweetIds
        })
        await loadDrafts()
      }
      setPosting(false)
    } else {
      // Post single tweet
      if (!text.trim() || text.length > 280) return
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
  }

  const handleCopy = () => {
    if (isThread) {
      const threadText = segments.filter(s => s.trim()).map((s, i) => `${i + 1}/ ${s}`).join('\n\n')
      if (threadText) window.electronAPI.writeClipboard(threadText)
    } else {
      if (text.trim()) window.electronAPI.writeClipboard(text.trim())
    }
  }

  // Persona handlers
  const handleCreatePersona = async () => {
    if (!personaFormName.trim() || !personaFormDesc.trim()) return
    const examples = personaFormExamples.filter(e => e.trim())
    if (examples.length === 0) return
    await window.electronAPI.createTweetPersona({
      name: personaFormName.trim(),
      description: personaFormDesc.trim(),
      exampleTweets: examples
    })
    await loadPersonas()
    setShowPersonaForm(false)
    setPersonaFormName('')
    setPersonaFormDesc('')
    setPersonaFormExamples(['', ''])
  }

  const handleDeletePersona = async (id: string) => {
    await window.electronAPI.deleteTweetPersona(id)
    if (activePersonaId === id) setActivePersonaId(null)
    await loadPersonas()
  }

  const charCount = text.length
  const overLimit = charCount > 280
  const hasContent = isThread ? segments.some(s => s.trim()) : text.trim().length > 0
  const anyOverLimit = isThread ? segments.some(s => s.length > 280) : overLimit

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
            <>
              {activeDraft.isThread && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple shrink-0">thread</span>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge(activeDraft.status)}`}>
                {activeDraft.status}
              </span>
            </>
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
                      {d.isThread && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple shrink-0">thread</span>
                      )}
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
            {/* Persona Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button
                onClick={() => setActivePersonaId(null)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap shrink-0 ${
                  !activePersonaId ? 'bg-accent-blue/20 text-accent-blue' : 'bg-surface-2 text-white/50 hover:bg-surface-3 hover:text-white/70'
                }`}
              >
                No persona
              </button>
              {allPersonas.map(p => (
                <div key={p.id} className="flex items-center shrink-0">
                  <button
                    onClick={() => setActivePersonaId(p.id === activePersonaId ? null : p.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
                      p.id === activePersonaId ? 'bg-accent-purple/20 text-accent-purple' : 'bg-surface-2 text-white/50 hover:bg-surface-3 hover:text-white/70'
                    }`}
                    title={p.description}
                  >
                    {p.name}
                  </button>
                  {!p.isBuiltIn && (
                    <button
                      onClick={() => handleDeletePersona(p.id)}
                      className="w-4 h-4 -ml-0.5 rounded-full hover:bg-accent-red/20 flex items-center justify-center text-muted hover:text-accent-red transition-all"
                      title="Delete persona"
                    >
                      <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setShowPersonaForm(!showPersonaForm)}
                className="px-2.5 py-1 rounded-full bg-surface-2 hover:bg-surface-3 text-[10px] text-muted hover:text-white/70 font-medium transition-all whitespace-nowrap shrink-0"
              >
                + Custom
              </button>
            </div>

            {/* Custom Persona Form */}
            {showPersonaForm && (
              <div className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/70 font-medium">New Persona</span>
                  <button
                    onClick={() => setShowPersonaForm(false)}
                    className="w-5 h-5 rounded hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white/60"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={personaFormName}
                  onChange={e => setPersonaFormName(e.target.value)}
                  placeholder="Persona name"
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50"
                />
                <input
                  type="text"
                  value={personaFormDesc}
                  onChange={e => setPersonaFormDesc(e.target.value)}
                  placeholder="Style description (e.g., Witty, data-driven, optimistic)"
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50"
                />
                {personaFormExamples.map((ex, i) => (
                  <textarea
                    key={i}
                    value={ex}
                    onChange={e => {
                      const updated = [...personaFormExamples]
                      updated[i] = e.target.value
                      setPersonaFormExamples(updated)
                    }}
                    placeholder={`Example tweet ${i + 1}`}
                    rows={2}
                    className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50 resize-none"
                  />
                ))}
                {personaFormExamples.length < 3 && (
                  <button
                    onClick={() => setPersonaFormExamples([...personaFormExamples, ''])}
                    className="text-[10px] text-muted hover:text-white/60 transition-all"
                  >
                    + Add example
                  </button>
                )}
                <button
                  onClick={handleCreatePersona}
                  disabled={!personaFormName.trim() || !personaFormDesc.trim() || !personaFormExamples.some(e => e.trim())}
                  className="w-full px-3 py-1.5 bg-accent-purple/20 hover:bg-accent-purple/30 disabled:opacity-30 rounded-lg text-[11px] text-accent-purple font-medium transition-all"
                >
                  Save Persona
                </button>
              </div>
            )}

            {/* Thread Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleThread}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  isThread
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : 'bg-surface-2 text-white/50 hover:bg-surface-3 hover:text-white/70'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {isThread ? 'Thread mode' : 'Single tweet'}
              </button>
              {isThread && (
                <span className="text-[10px] text-muted">
                  {segments.length} tweet{segments.length !== 1 ? 's' : ''} in thread
                </span>
              )}
            </div>

            {/* Tweet Editor */}
            {isThread ? (
              /* Thread: Stacked Segment Editors */
              <div className="space-y-2">
                {segments.map((seg, i) => (
                  <div key={i} className="glass-card rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-muted font-mono">{i + 1}/{segments.length}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono ${seg.length > 280 ? 'text-accent-red' : seg.length > 250 ? 'text-accent-amber' : 'text-muted/60'}`}>
                          {seg.length}/280
                        </span>
                        {segments.length > 1 && (
                          <button
                            onClick={() => removeSegment(i)}
                            className="w-5 h-5 rounded hover:bg-accent-red/20 flex items-center justify-center text-muted hover:text-accent-red transition-all"
                            title="Remove segment"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      ref={i === 0 ? textareaRef : undefined}
                      value={seg}
                      onChange={e => handleSegmentChange(i, e.target.value)}
                      placeholder={i === 0 ? 'First tweet (the hook)...' : `Tweet ${i + 1}...`}
                      rows={3}
                      className="w-full bg-transparent border-none text-sm text-white/90 focus:outline-none resize-none placeholder-muted/50"
                    />
                    {seg.length > 0 && (
                      <div className="w-full h-1 rounded-full bg-surface-3 overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${seg.length > 280 ? 'bg-accent-red' : seg.length > 250 ? 'bg-accent-amber' : 'bg-accent-blue'}`}
                          style={{ width: `${Math.min(100, (seg.length / 280) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSegment}
                  className="w-full py-2 rounded-xl border border-dashed border-white/[0.08] hover:border-white/[0.15] hover:bg-surface-2/50 text-[11px] text-muted hover:text-white/60 font-medium transition-all"
                >
                  + Add tweet to thread
                </button>
                {/* Thread action bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {postResult && (
                      <span className={`text-[10px] ${postResult.success ? 'text-accent-emerald' : 'text-accent-red'}`}>
                        {postResult.success ? 'Thread posted!' : postResult.error}
                      </span>
                    )}
                    {postProgress && (
                      <span className="text-[10px] text-accent-amber">{postProgress}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopy}
                      disabled={!hasContent}
                      className="px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 disabled:opacity-30 text-[10px] text-white/60 font-medium transition-all"
                      title="Copy thread"
                    >
                      Copy
                    </button>
                    <button
                      onClick={handlePost}
                      disabled={!hasContent || anyOverLimit || posting || activeDraft.status === 'posted'}
                      className="px-3 py-1 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 rounded-lg text-[10px] text-white font-medium transition-all"
                    >
                      {posting ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : activeDraft.status === 'posted' ? 'Posted' : 'Post Thread'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Tweet Editor */
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
            )}

            {/* Action Pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={handleBrainstorm}
                disabled={aiLoading || (!hasContent && !activeDraft.topic)}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">💡</span> Brainstorm
              </button>
              <button
                onClick={() => handleRefine()}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">✨</span> Refine
              </button>
              <button
                onClick={handleAnalyze}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">🎯</span> Analyze
              </button>
              <button
                onClick={() => handleRefine('Make it punchier and more concise. Remove filler words.')}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">⚡</span> Punchier
              </button>
              <button
                onClick={() => handleRefine('Add a strong hook in the first line that makes people stop scrolling.')}
                disabled={aiLoading || !hasContent}
                className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 disabled:opacity-30 text-[11px] text-white/70 font-medium transition-all flex items-center gap-1"
              >
                <span className="text-sm">🪝</span> Add hook
              </button>
              <button
                onClick={() => handleRefine('Take a contrarian or surprising angle on this same topic.')}
                disabled={aiLoading || !hasContent}
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
                  {activePersona && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple/70">
                      as {activePersona.name}
                    </span>
                  )}
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
                        {isThread && extractTweets(aiResponse).length > 1 && (
                          <button
                            onClick={handleUseAllTweets}
                            className="w-full px-3 py-1.5 rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 text-[10px] text-accent-purple font-medium transition-all mb-1"
                          >
                            Use all as thread ({extractTweets(aiResponse).length} tweets)
                          </button>
                        )}
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
                placeholder={isThread ? "Ask Claude anything about this thread..." : "Ask Claude anything about this tweet..."}
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
