import { useEffect, useState } from 'react'
import { useContentStore } from '../store/contentStore'
import { useContentStreaming } from '../hooks/useContentStreaming'
import { ContentType } from '../types'
import { renderMarkdown } from '../utils/markdown'
import Button from './ui/Button'

const CONTENT_TYPES: { id: ContentType; label: string }[] = [
  { id: 'tweet', label: 'Tweet' },
  { id: 'thread', label: 'Thread' },
  { id: 'blog_post', label: 'Blog' },
  { id: 'article', label: 'Article' },
  { id: 'discord_post', label: 'Discord' },
  { id: 'newsletter', label: 'Newsletter' },
]

const QUICK_ACTIONS = [
  { id: 'shorter', label: 'Shorter' },
  { id: 'punchier', label: 'Punchier' },
  { id: 'hook', label: 'Hook' },
  { id: 'technical', label: 'Technical' },
  { id: 'simpler', label: 'Simpler' },
  { id: 'contrarian', label: 'Contrarian' },
]

const TWEET_QUICK_ACTIONS = [
  { id: 'provocative', label: 'Provocative' },
  { id: 'flip', label: 'Flip It' },
  { id: 'eli5', label: 'ELI5' },
  { id: 'pain_point', label: 'Pain Point' },
  { id: 'mic_drop', label: 'Mic Drop' },
  { id: 'story', label: 'Story' },
]

function parseTweetBlocks(text: string) {
  const blocks = text.split(/(?=\*\*\d+\.\s)/).filter(b => b.trim())
  return blocks.map((block) => {
    const lines = block.trim().split('\n').filter(l => l.trim())
    // First line is the **N. Device Name** header
    const headerMatch = lines[0]?.match(/^\*\*\d+\.\s*(.+?)\*\*$/)
    const device = headerMatch ? headerMatch[1].trim() : ''
    // Strategy line: italic line with engagement tag (starts with _ or contains · X/280)
    const strategyLine = lines.find(l => l.match(/^_.*\d+\/280.*_$/) || l.match(/^_.*·.*_$/))
    const strategy = strategyLine ? strategyLine.replace(/^_|_$/g, '').trim() : ''
    // Tweet text: skip header, skip strategy line, skip char count line, skip ---
    const tweetLines = lines.filter(
      l => !l.match(/^\*\*\d+\./) && !l.match(/^\d+\/280/) && !l.match(/^---/) && l !== strategyLine
    )
    const tweetText = tweetLines.join('\n').trim()
    return { device, tweetText, strategy }
  })
}

function TweetCards({ text }: { text: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const blocks = parseTweetBlocks(text)

  const copyOne = (tweetText: string, idx: number) => {
    window.electronAPI.writeClipboard(tweetText)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (blocks.length <= 1) {
    // Single tweet or unstructured — render as-is with char count
    const plain = text.replace(/\*\*.*?\*\*/g, '').replace(/---/g, '').trim()
    const len = plain.length
    return (
      <div>
        <div
          className="text-[12px] text-white/85 leading-relaxed content-markdown"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
        <div className={`text-[10px] mt-2 ${len > 280 ? 'text-accent-red' : 'text-white/30'}`}>
          {len}/280 chars
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const len = block.tweetText.length
        return (
          <div key={i} className="bg-surface-2 border border-white/[0.06] rounded-lg p-3 space-y-2">
            {block.device && (
              <div className="text-[10px] font-medium text-accent-blue/70 uppercase tracking-wider">
                {block.device}
              </div>
            )}
            <div className="text-[12px] text-white/85 leading-relaxed whitespace-pre-wrap">
              {block.tweetText}
            </div>
            {block.strategy && (
              <div className="text-[10px] text-white/40 italic border-t border-white/[0.04] pt-1.5">
                {block.strategy}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className={`text-[10px] ${len > 280 ? 'text-accent-red' : 'text-white/30'}`}>
                {len}/280 chars{len > 280 && ' ⚠'}
              </span>
              <button
                onClick={() => copyOne(block.tweetText, i)}
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                {copiedIdx === i ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ContentTab() {
  const {
    drafts, activeDraftId, contentType, topic, researchText, streamText,
    researching, streaming, refineInput,
    setContentType, setTopic, setRefineInput,
    loadDrafts, handleNewTopic, handleResearch, handleGenerate,
    handleQuickAction, handleAbortResearch, handleAbortDraft,
    handleCopy, handleDelete, handleSave, selectDraft,
  } = useContentStore()

  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

  useContentStreaming()

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  const onCopy = () => {
    handleCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onResearch = () => {
    if (topic.trim()) handleResearch()
  }

  const onRefineSubmit = () => {
    if (refineInput.trim()) {
      const input = refineInput
      setRefineInput('')
      useContentStore.getState().handleRefine(input)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/[0.06]">
        <Button variant="primary" size="sm" onClick={handleNewTopic}>
          + New Topic
        </Button>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            Draft History {showHistory ? '▴' : '▾'}
          </Button>
          {showHistory && drafts.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-surface-2 border border-white/[0.08] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {drafts.map(d => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] cursor-pointer text-[11px] ${d.id === activeDraftId ? 'bg-white/[0.06]' : ''}`}
                  onClick={() => { selectDraft(d.id); setShowHistory(false) }}
                >
                  <div className="truncate flex-1 mr-2">
                    <span className="text-white/80">{d.topic || 'Untitled'}</span>
                    <span className="text-white/30 ml-1.5">{d.contentType}</span>
                  </div>
                  <button
                    className="text-white/20 hover:text-accent-red text-[10px] shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(d.id) }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {activeDraftId && (
          <span className="text-[10px] text-white/30 ml-auto">
            Draft: {activeDraftId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Main content — side by side */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel — Research */}
        <div className="w-[40%] border-r border-white/[0.06] flex flex-col min-h-0">
          <div className="p-3 space-y-2">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Topic</label>
            <textarea
              className="w-full bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-white/20 resize-none focus:outline-none focus:border-accent-blue/40"
              rows={3}
              placeholder="What should we write about?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onResearch()
                }
              }}
            />
            <div className="flex gap-2">
              {researching ? (
                <Button variant="danger" size="sm" onClick={handleAbortResearch}>
                  Stop Research
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={onResearch} disabled={!topic.trim()}>
                  Research ▸
                </Button>
              )}
            </div>
          </div>

          {/* Research output */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
            {researching && !researchText && (
              <div className="flex items-center gap-2 text-[11px] text-white/40 mt-2">
                <div className="w-3 h-3 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                Researching...
              </div>
            )}
            {researchText && (
              <div className="space-y-2">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Research Context</div>
                <div
                  className="text-[11px] text-white/70 leading-relaxed content-markdown"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(researchText) }}
                />
              </div>
            )}
            {!researchText && !researching && (
              <div className="flex items-center justify-center h-32 text-[11px] text-white/20">
                Enter a topic and click Research to get started
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Drafting */}
        <div className="w-[60%] flex flex-col min-h-0">
          {/* Format selector */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <label className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Format</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setContentType(ct.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    contentType === ct.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-surface-3 text-white/50 hover:text-white/70 hover:bg-surface-4'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={!researchText || streaming}
            >
              {streaming ? 'Generating...' : 'Generate Draft'}
            </Button>
          </div>

          {/* Draft output */}
          <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
            {streaming && !streamText && (
              <div className="flex items-center gap-2 text-[11px] text-white/40 mt-2">
                <div className="w-3 h-3 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                Generating {contentType.replace('_', ' ')}...
              </div>
            )}
            {streamText ? (
              contentType === 'tweet' && !streaming ? (
                <TweetCards text={streamText} />
              ) : (
                <div
                  className="text-[12px] text-white/85 leading-relaxed content-markdown"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamText) }}
                />
              )
            ) : !streaming ? (
              <div className="flex items-center justify-center h-32 text-[11px] text-white/20">
                {researchText ? 'Pick a format and generate a draft' : 'Research a topic first'}
              </div>
            ) : null}
          </div>

          {/* Actions — only show when we have content */}
          {(streamText || streaming) && (
            <div className="border-t border-white/[0.06] p-3 space-y-2">
              {streaming && (
                <Button variant="danger" size="xs" onClick={handleAbortDraft}>
                  Stop
                </Button>
              )}

              {/* Quick actions */}
              {streamText && !streaming && (
                <>
                  <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Quick Actions</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(contentType === 'tweet' ? TWEET_QUICK_ACTIONS : QUICK_ACTIONS).map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleQuickAction(a.id)}
                        className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-surface-3 text-white/50 hover:text-white/70 hover:bg-surface-4 transition-all"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>

                  {/* Refine input */}
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-surface-2 border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-white/90 placeholder:text-white/20 focus:outline-none focus:border-accent-blue/40"
                      placeholder="Custom refinement instruction..."
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onRefineSubmit()
                      }}
                    />
                    <Button variant="secondary" size="sm" onClick={onRefineSubmit} disabled={!refineInput.trim()}>
                      Send
                    </Button>
                  </div>

                  {/* Copy / Save */}
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={onCopy}>
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSave}>
                      Save Draft
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
