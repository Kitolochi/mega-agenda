import { create } from 'zustand'
import { ContentDraft, ContentType, TweetScore } from '../types'

interface ContentState {
  drafts: ContentDraft[]
  activeDraftId: string | null
  contentType: ContentType
  topic: string
  researchText: string
  streamText: string
  researching: boolean
  streaming: boolean
  scoring: boolean
  tweetScores: TweetScore[] | null
  refineInput: string

  // Actions
  setContentType: (type: ContentType) => void
  setTopic: (topic: string) => void
  setResearchText: (text: string) => void
  setStreamText: (text: string) => void
  setResearching: (v: boolean) => void
  setStreaming: (v: boolean) => void
  setScoring: (v: boolean) => void
  setTweetScores: (scores: TweetScore[] | null) => void
  setRefineInput: (v: string) => void
  setActiveDraftId: (id: string | null) => void

  loadDrafts: () => Promise<void>
  handleNewTopic: () => Promise<void>
  handleResearch: () => Promise<void>
  handleGenerate: () => Promise<void>
  handleRefine: (instruction: string) => Promise<void>
  handleQuickAction: (action: string) => Promise<void>
  handleAbortResearch: () => Promise<void>
  handleAbortDraft: () => Promise<void>
  handleCopy: () => void
  handleDelete: (id: string) => Promise<void>
  handleSave: () => Promise<void>
  selectDraft: (id: string) => Promise<void>
}

export const useContentStore = create<ContentState>((set, get) => ({
  drafts: [],
  activeDraftId: null,
  contentType: 'tweet',
  topic: '',
  researchText: '',
  streamText: '',
  researching: false,
  streaming: false,
  scoring: false,
  tweetScores: null,
  refineInput: '',

  setContentType: (type) => set({ contentType: type }),
  setTopic: (topic) => set({ topic }),
  setResearchText: (text) => set({ researchText: text }),
  setStreamText: (text) => set({ streamText: text }),
  setResearching: (v) => set({ researching: v }),
  setStreaming: (v) => set({ streaming: v }),
  setScoring: (v) => set({ scoring: v }),
  setTweetScores: (scores) => set({ tweetScores: scores }),
  setRefineInput: (v) => set({ refineInput: v }),
  setActiveDraftId: (id) => set({ activeDraftId: id }),

  loadDrafts: async () => {
    const drafts = await window.electronAPI.getContentDrafts()
    set({ drafts })
  },

  handleNewTopic: async () => {
    const draft = await window.electronAPI.createContentDraft()
    set({
      activeDraftId: draft.id,
      topic: '',
      researchText: '',
      streamText: '',
      contentType: 'tweet',
      researching: false,
      streaming: false,
      scoring: false,
      tweetScores: null,
      refineInput: '',
    })
    await get().loadDrafts()
  },

  handleResearch: async () => {
    const { activeDraftId, topic } = get()
    if (!topic.trim()) return

    let draftId = activeDraftId
    if (!draftId) {
      const draft = await window.electronAPI.createContentDraft(topic)
      draftId = draft.id
      set({ activeDraftId: draftId })
    }

    // Save topic
    await window.electronAPI.updateContentDraft(draftId, { topic, status: 'researching' })

    set({ researching: true, researchText: '' })
    await window.electronAPI.contentResearch(draftId, topic)
  },

  handleGenerate: async () => {
    const { activeDraftId, contentType, researchText, topic } = get()
    if (!activeDraftId) return

    const userPrompt = `Topic: ${topic}\n\nResearch context:\n${researchText}\n\nWrite ${contentType.replace('_', ' ')} content about this topic.`
    const messages = [{ role: 'user', content: userPrompt }]

    await window.electronAPI.updateContentDraft(activeDraftId, {
      contentType,
      status: 'drafting',
      messages: [{ id: Date.now().toString(36), role: 'user' as const, content: userPrompt, timestamp: new Date().toISOString() }],
    })

    set({ streaming: true, streamText: '', scoring: false, tweetScores: null })
    await window.electronAPI.contentGenerate(activeDraftId, messages, contentType)
  },

  handleRefine: async (instruction: string) => {
    const { activeDraftId, contentType, streamText } = get()
    if (!activeDraftId || !streamText) return

    const messages = [
      { role: 'user', content: `Here is the current draft:\n\n${streamText}` },
      { role: 'assistant', content: streamText },
      { role: 'user', content: instruction },
    ]

    await window.electronAPI.updateContentDraft(activeDraftId, { status: 'refining' })

    set({ streaming: true, streamText: '', scoring: false, tweetScores: null })
    await window.electronAPI.contentGenerate(activeDraftId, messages, contentType)
  },

  handleQuickAction: async (action: string) => {
    const genericPrompts: Record<string, string> = {
      shorter: 'Make this significantly shorter and more concise while keeping the key message.',
      punchier: 'Make this punchier and more impactful. Stronger opening, tighter language.',
      hook: 'Rewrite with a much stronger hook/opening that grabs attention immediately.',
      technical: 'Add more technical depth and specifics. Include concrete mechanisms and numbers.',
      simpler: 'Simplify this for a broader audience. Less jargon, more accessible language.',
      contrarian: 'Rewrite with a more contrarian angle. Challenge conventional wisdom.',
    }
    const tweetPrompts: Record<string, string> = {
      provocative: 'Rewrite to be more provocative and challenge what everyone assumes. Make people stop scrolling. Plain language, no jargon.',
      flip: 'Flip the framing completely — approach from the opposite angle. Old way vs new way. Keep it dead simple.',
      eli5: 'Way too complicated. Rewrite like you\'re explaining to a 10-year-old. Use only words a kid would know. No crypto terms AT ALL — no yield, no protocol, no collateral, no DeFi, no stablecoin. Just say what it does in the simplest possible way. Example level: "You borrow money. The app pays it back for you. You keep the money."',
      pain_point: 'Rewrite to speak directly to a pain point — debt stress, feeling ripped off by banks, wanting passive income. Make it personal, not abstract.',
      mic_drop: 'Rewrite as a single devastating one-liner. Maximum impact, minimum words. Mic-drop energy.',
      story: 'Rewrite as a micro-story or before/after. "I did X. Then Y happened." Make it feel real, not like marketing.',
    }
    const prompts = get().contentType === 'tweet' ? tweetPrompts : genericPrompts
    const prompt = prompts[action]
    if (prompt) await get().handleRefine(prompt)
  },

  handleAbortResearch: async () => {
    await window.electronAPI.contentResearchAbort()
    set({ researching: false })
  },

  handleAbortDraft: async () => {
    await window.electronAPI.contentAbort()
    set({ streaming: false })
  },

  handleCopy: () => {
    const { streamText } = get()
    if (streamText) window.electronAPI.writeClipboard(streamText)
  },

  handleDelete: async (id: string) => {
    await window.electronAPI.deleteContentDraft(id)
    const { activeDraftId } = get()
    if (activeDraftId === id) {
      set({ activeDraftId: null, topic: '', researchText: '', streamText: '', refineInput: '' })
    }
    await get().loadDrafts()
  },

  handleSave: async () => {
    const { activeDraftId, streamText, researchText, contentType } = get()
    if (!activeDraftId) return
    await window.electronAPI.updateContentDraft(activeDraftId, {
      content: streamText,
      research: researchText,
      contentType,
      status: 'ready',
    })
    await get().loadDrafts()
  },

  selectDraft: async (id: string) => {
    const draft = await window.electronAPI.getContentDraft(id)
    if (!draft) return
    set({
      activeDraftId: draft.id,
      topic: draft.topic,
      researchText: draft.research,
      streamText: draft.content,
      contentType: draft.contentType,
      researching: false,
      streaming: false,
      scoring: false,
      tweetScores: null,
      refineInput: '',
    })
  },
}))
