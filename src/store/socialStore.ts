import { create } from 'zustand'
import { TweetDraft, TweetAIMessage, TweetPersona } from '../types'
import { generateId } from '../utils/formatting'

export const BUILT_IN_PERSONAS: TweetPersona[] = [
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

export function extractTweets(text: string): string[] {
  const tweets: string[] = []
  const backtickMatches = text.match(/`([^`]+)`/g)
  if (backtickMatches) {
    for (const match of backtickMatches) {
      const content = match.slice(1, -1).trim()
      if (content.length > 10 && content.length <= 280) {
        tweets.push(content)
      }
    }
  }
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

interface SocialState {
  // Draft state
  drafts: TweetDraft[]
  activeDraftId: string | null
  text: string
  segments: string[]
  isThread: boolean
  showDraftList: boolean

  // AI state
  aiResponse: string
  aiLoading: boolean
  freeformInput: string

  // Post state
  posting: boolean
  postProgress: string
  postResult: { success: boolean; error?: string } | null

  // Topic
  topicInput: string

  // Persona state
  customPersonas: TweetPersona[]
  activePersonaId: string | null
  showPersonaForm: boolean
  personaFormName: string
  personaFormDesc: string
  personaFormExamples: string[]

  // Actions
  setDrafts: (drafts: TweetDraft[]) => void
  setActiveDraftId: (id: string | null) => void
  setText: (text: string) => void
  setSegments: (segments: string[]) => void
  setIsThread: (isThread: boolean) => void
  setShowDraftList: (show: boolean) => void
  setAiResponse: (response: string) => void
  setAiLoading: (loading: boolean) => void
  setFreeformInput: (input: string) => void
  setPosting: (posting: boolean) => void
  setPostProgress: (progress: string) => void
  setPostResult: (result: { success: boolean; error?: string } | null) => void
  setTopicInput: (input: string) => void
  setCustomPersonas: (personas: TweetPersona[]) => void
  setActivePersonaId: (id: string | null) => void
  setShowPersonaForm: (show: boolean) => void
  setPersonaFormName: (name: string) => void
  setPersonaFormDesc: (desc: string) => void
  setPersonaFormExamples: (examples: string[]) => void

  // Derived helpers
  getAllPersonas: () => TweetPersona[]
  getActivePersona: () => TweetPersona | undefined
  getActiveDraft: () => TweetDraft | null

  // Complex actions
  loadDrafts: () => Promise<void>
  loadPersonas: () => Promise<void>
  loadActiveDraftState: () => void
  handleTextChange: (newText: string, saveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => void
  handleSegmentChange: (index: number, value: string, saveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => void
  addSegment: () => void
  removeSegment: (index: number) => void
  toggleThread: () => Promise<void>
  handleNewDraft: (topic?: string) => Promise<void>
  handleDeleteDraft: () => Promise<void>
  handleSelectDraft: (id: string) => void
  buildAIHistory: () => { role: string; content: string }[]
  saveAIMessage: (role: 'user' | 'assistant', type: TweetAIMessage['type'], content: string) => Promise<void>
  handleBrainstorm: () => Promise<void>
  handleRefine: (instruction?: string) => Promise<void>
  handleAnalyze: () => Promise<void>
  handleFreeform: () => Promise<void>
  handleUseTweet: (tweetText: string) => Promise<void>
  handleUseAllTweets: () => Promise<void>
  handlePost: () => Promise<void>
  handleCopy: () => void
  handleCreatePersona: () => Promise<void>
  handleDeletePersona: (id: string) => Promise<void>
}

export const useSocialStore = create<SocialState>((set, get) => ({
  // Draft state
  drafts: [],
  activeDraftId: null,
  text: '',
  segments: [''],
  isThread: false,
  showDraftList: false,

  // AI state
  aiResponse: '',
  aiLoading: false,
  freeformInput: '',

  // Post state
  posting: false,
  postProgress: '',
  postResult: null,

  // Topic
  topicInput: '',

  // Persona state
  customPersonas: [],
  activePersonaId: null,
  showPersonaForm: false,
  personaFormName: '',
  personaFormDesc: '',
  personaFormExamples: ['', ''],

  // Simple setters
  setDrafts: (drafts) => set({ drafts }),
  setActiveDraftId: (id) => set({ activeDraftId: id }),
  setText: (text) => set({ text }),
  setSegments: (segments) => set({ segments }),
  setIsThread: (isThread) => set({ isThread }),
  setShowDraftList: (show) => set({ showDraftList: show }),
  setAiResponse: (response) => set({ aiResponse: response }),
  setAiLoading: (loading) => set({ aiLoading: loading }),
  setFreeformInput: (input) => set({ freeformInput: input }),
  setPosting: (posting) => set({ posting }),
  setPostProgress: (progress) => set({ postProgress: progress }),
  setPostResult: (result) => set({ postResult: result }),
  setTopicInput: (input) => set({ topicInput: input }),
  setCustomPersonas: (personas) => set({ customPersonas: personas }),
  setActivePersonaId: (id) => set({ activePersonaId: id }),
  setShowPersonaForm: (show) => set({ showPersonaForm: show }),
  setPersonaFormName: (name) => set({ personaFormName: name }),
  setPersonaFormDesc: (desc) => set({ personaFormDesc: desc }),
  setPersonaFormExamples: (examples) => set({ personaFormExamples: examples }),

  // Derived helpers
  getAllPersonas: () => {
    const { customPersonas } = get()
    return [...BUILT_IN_PERSONAS, ...customPersonas]
  },
  getActivePersona: () => {
    const { activePersonaId } = get()
    const allPersonas = get().getAllPersonas()
    return allPersonas.find(p => p.id === activePersonaId) || undefined
  },
  getActiveDraft: () => {
    const { drafts, activeDraftId } = get()
    return drafts.find(d => d.id === activeDraftId) || null
  },

  // Complex actions
  loadDrafts: async () => {
    const d = await window.electronAPI.getTweetDrafts()
    set({ drafts: d })
  },

  loadPersonas: async () => {
    const p = await window.electronAPI.getTweetPersonas()
    set({ customPersonas: p })
  },

  loadActiveDraftState: () => {
    const activeDraft = get().getActiveDraft()
    if (activeDraft) {
      const seg = activeDraft.segments && activeDraft.segments.length > 0
        ? activeDraft.segments
        : (activeDraft.text ? [activeDraft.text] : [''])
      set({
        text: activeDraft.text,
        segments: seg,
        isThread: activeDraft.isThread || false,
        aiResponse: '',
        postResult: null,
        postProgress: ''
      })
    }
  },

  handleTextChange: (newText, saveTimeoutRef) => {
    set({ text: newText })
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    const { activeDraftId } = get()
    if (activeDraftId) {
      const draftId = activeDraftId
      saveTimeoutRef.current = setTimeout(async () => {
        await window.electronAPI.updateTweetDraft(draftId, { text: newText, segments: [newText] })
      }, 500)
    }
  },

  handleSegmentChange: (index, value, saveTimeoutRef) => {
    const { segments, activeDraftId } = get()
    const updated = [...segments]
    updated[index] = value
    const newState: Partial<SocialState> = { segments: updated }
    if (index === 0) newState.text = value
    set(newState)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (activeDraftId) {
      const draftId = activeDraftId
      saveTimeoutRef.current = setTimeout(async () => {
        await window.electronAPI.updateTweetDraft(draftId, { segments: updated, text: updated[0] || '' })
      }, 500)
    }
  },

  addSegment: () => {
    const { segments, activeDraftId } = get()
    const updated = [...segments, '']
    set({ segments: updated })
    if (activeDraftId) {
      window.electronAPI.updateTweetDraft(activeDraftId, { segments: updated })
    }
  },

  removeSegment: (index) => {
    const { segments, activeDraftId } = get()
    if (segments.length <= 1) return
    const updated = segments.filter((_, i) => i !== index)
    const newState: Partial<SocialState> = { segments: updated }
    if (index === 0) newState.text = updated[0] || ''
    set(newState)
    if (activeDraftId) {
      window.electronAPI.updateTweetDraft(activeDraftId, { segments: updated, text: updated[0] || '' })
    }
  },

  toggleThread: async () => {
    const { isThread, activeDraftId, segments } = get()
    const newIsThread = !isThread
    set({ isThread: newIsThread })
    if (activeDraftId) {
      if (newIsThread && segments.length === 1 && !segments[0]) {
        // Starting fresh thread — keep single empty segment
      }
      await window.electronAPI.updateTweetDraft(activeDraftId, { isThread: newIsThread })
      await get().loadDrafts()
    }
  },

  handleNewDraft: async (topic?: string) => {
    const draft = await window.electronAPI.createTweetDraft(topic)
    await get().loadDrafts()
    set({
      activeDraftId: draft.id,
      text: '',
      segments: [''],
      isThread: false,
      aiResponse: '',
      topicInput: '',
      showDraftList: false,
    })
  },

  handleDeleteDraft: async () => {
    const { activeDraftId } = get()
    if (!activeDraftId) return
    await window.electronAPI.deleteTweetDraft(activeDraftId)
    await get().loadDrafts()
    set({
      activeDraftId: null,
      text: '',
      segments: [''],
      isThread: false,
      aiResponse: '',
    })
  },

  handleSelectDraft: (id) => {
    set({ activeDraftId: id, showDraftList: false })
  },

  buildAIHistory: () => {
    const activeDraft = get().getActiveDraft()
    if (!activeDraft) return []
    return activeDraft.aiHistory.map(m => ({
      role: m.role,
      content: m.content
    }))
  },

  saveAIMessage: async (role, type, content) => {
    const { activeDraftId } = get()
    if (!activeDraftId) return
    const msg: TweetAIMessage = {
      id: generateId(),
      role,
      type,
      content,
      timestamp: new Date().toISOString()
    }
    await window.electronAPI.addTweetAIMessage(activeDraftId, msg)
    await get().loadDrafts()
  },

  handleBrainstorm: async () => {
    const { activeDraftId, aiLoading, text, topicInput, isThread } = get()
    const activeDraft = get().getActiveDraft()
    if (!activeDraftId || aiLoading) return
    const topic = activeDraft?.topic || text || topicInput
    if (!topic.trim()) return
    set({ aiLoading: true, aiResponse: '' })
    try {
      const userMsg = isThread
        ? `Brainstorm thread about: "${topic}"`
        : `Brainstorm tweets about: "${topic}"`
      await get().saveAIMessage('user', 'brainstorm', userMsg)
      const activePersona = get().getActivePersona()
      const response = isThread
        ? await window.electronAPI.tweetBrainstormThread(topic, get().buildAIHistory(), activePersona)
        : await window.electronAPI.tweetBrainstorm(topic, get().buildAIHistory(), activePersona)
      set({ aiResponse: response })
      await get().saveAIMessage('assistant', 'brainstorm', response)
      await window.electronAPI.updateTweetDraft(activeDraftId, { status: 'refining' })
      await get().loadDrafts()
    } catch (err: any) {
      set({ aiResponse: `Error: ${err.message || 'Failed to brainstorm'}` })
    }
    set({ aiLoading: false })
  },

  handleRefine: async (instruction?: string) => {
    const { activeDraftId, aiLoading, isThread, segments, text } = get()
    if (!activeDraftId || aiLoading) return
    const currentText = isThread ? segments.join('\n\n---\n\n') : text
    if (!currentText.trim()) return
    const refinementInstruction = instruction || (isThread
      ? 'Improve this thread. Make each tweet more engaging while maintaining narrative flow.'
      : 'Improve this tweet. Make it more engaging and punchy.')
    set({ aiLoading: true, aiResponse: '' })
    try {
      const userMsg = `Refine: "${currentText}" — ${refinementInstruction}`
      await get().saveAIMessage('user', 'refine', userMsg)
      const activePersona = get().getActivePersona()
      const response = await window.electronAPI.tweetRefine(currentText, refinementInstruction, get().buildAIHistory(), activePersona)
      set({ aiResponse: response })
      await get().saveAIMessage('assistant', 'refine', response)
      await window.electronAPI.updateTweetDraft(activeDraftId, { status: 'refining' })
      await get().loadDrafts()
    } catch (err: any) {
      set({ aiResponse: `Error: ${err.message || 'Failed to refine'}` })
    }
    set({ aiLoading: false })
  },

  handleAnalyze: async () => {
    const { activeDraftId, aiLoading, isThread, segments, text } = get()
    if (!activeDraftId || aiLoading) return
    const currentText = isThread ? segments.join('\n\n---\n\n') : text
    if (!currentText.trim()) return
    set({ aiLoading: true, aiResponse: '' })
    try {
      const userMsg = `Analyze: "${currentText}"`
      await get().saveAIMessage('user', 'analyze', userMsg)
      const response = await window.electronAPI.tweetAnalyze(currentText)
      set({ aiResponse: response })
      await get().saveAIMessage('assistant', 'analyze', response)
      await get().loadDrafts()
    } catch (err: any) {
      set({ aiResponse: `Error: ${err.message || 'Failed to analyze'}` })
    }
    set({ aiLoading: false })
  },

  handleFreeform: async () => {
    const { activeDraftId, aiLoading, freeformInput, isThread, segments, text } = get()
    if (!activeDraftId || aiLoading || !freeformInput.trim()) return
    set({ aiLoading: true, aiResponse: '' })
    try {
      const instruction = freeformInput.trim()
      set({ freeformInput: '' })
      await get().saveAIMessage('user', 'freeform', instruction)
      const currentText = isThread ? segments.join('\n\n---\n\n') : text
      const activePersona = get().getActivePersona()
      const response = await window.electronAPI.tweetRefine(
        currentText || '(no draft yet)',
        instruction,
        get().buildAIHistory(),
        activePersona
      )
      set({ aiResponse: response })
      await get().saveAIMessage('assistant', 'freeform', response)
      await get().loadDrafts()
    } catch (err: any) {
      set({ aiResponse: `Error: ${err.message || 'Failed'}` })
    }
    set({ aiLoading: false })
  },

  handleUseTweet: async (tweetText) => {
    const { isThread, aiResponse, activeDraftId } = get()
    if (isThread) {
      const extracted = extractTweets(aiResponse)
      if (extracted.length > 1) {
        set({ segments: extracted, text: extracted[0] })
        if (activeDraftId) {
          await window.electronAPI.updateTweetDraft(activeDraftId, {
            segments: extracted,
            text: extracted[0],
            status: 'ready'
          })
          await get().loadDrafts()
        }
        return
      }
    }
    set({ text: tweetText })
    if (activeDraftId) {
      await window.electronAPI.updateTweetDraft(activeDraftId, { text: tweetText, segments: [tweetText], status: 'ready' })
      await get().loadDrafts()
    }
  },

  handleUseAllTweets: async () => {
    const { aiResponse, isThread, activeDraftId } = get()
    const extracted = extractTweets(aiResponse)
    if (extracted.length === 0) return
    if (isThread) {
      set({ segments: extracted, text: extracted[0] })
      if (activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, {
          segments: extracted,
          text: extracted[0],
          status: 'ready'
        })
        await get().loadDrafts()
      }
    } else {
      set({ text: extracted[0] })
      if (activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, { text: extracted[0], segments: [extracted[0]], status: 'ready' })
        await get().loadDrafts()
      }
    }
  },

  handlePost: async () => {
    const { posting, isThread, segments, text, activeDraftId } = get()
    if (posting) return
    if (isThread) {
      const validSegments = segments.filter(s => s.trim())
      if (validSegments.length === 0 || validSegments.some(s => s.length > 280)) return
      set({ posting: true, postResult: null, postProgress: `Posting 1/${validSegments.length}...` })
      const tweetIds: string[] = []
      let lastTweetId: string | undefined

      for (let i = 0; i < validSegments.length; i++) {
        set({ postProgress: `Posting ${i + 1}/${validSegments.length}...` })
        const result = await window.electronAPI.postTweet(validSegments[i].trim(), lastTweetId)
        if (!result.success) {
          set({ postResult: { success: false, error: `Failed at tweet ${i + 1}: ${result.error}` }, posting: false, postProgress: '' })
          return
        }
        tweetIds.push(result.tweetId!)
        lastTweetId = result.tweetId
      }

      set({ postResult: { success: true }, postProgress: '' })
      if (activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, {
          status: 'posted',
          postedAt: new Date().toISOString(),
          tweetId: tweetIds[0],
          threadTweetIds: tweetIds
        })
        await get().loadDrafts()
      }
      set({ posting: false })
    } else {
      if (!text.trim() || text.length > 280) return
      set({ posting: true, postResult: null })
      const result = await window.electronAPI.postTweet(text.trim())
      set({ postResult: result })
      if (result.success && activeDraftId) {
        await window.electronAPI.updateTweetDraft(activeDraftId, {
          status: 'posted',
          postedAt: new Date().toISOString(),
          tweetId: result.tweetId
        })
        await get().loadDrafts()
      }
      set({ posting: false })
    }
  },

  handleCopy: () => {
    const { isThread, segments, text } = get()
    if (isThread) {
      const threadText = segments.filter(s => s.trim()).map((s, i) => `${i + 1}/ ${s}`).join('\n\n')
      if (threadText) window.electronAPI.writeClipboard(threadText)
    } else {
      if (text.trim()) window.electronAPI.writeClipboard(text.trim())
    }
  },

  handleCreatePersona: async () => {
    const { personaFormName, personaFormDesc, personaFormExamples } = get()
    if (!personaFormName.trim() || !personaFormDesc.trim()) return
    const examples = personaFormExamples.filter(e => e.trim())
    if (examples.length === 0) return
    await window.electronAPI.createTweetPersona({
      name: personaFormName.trim(),
      description: personaFormDesc.trim(),
      exampleTweets: examples
    })
    await get().loadPersonas()
    set({
      showPersonaForm: false,
      personaFormName: '',
      personaFormDesc: '',
      personaFormExamples: ['', '']
    })
  },

  handleDeletePersona: async (id) => {
    const { activePersonaId } = get()
    await window.electronAPI.deleteTweetPersona(id)
    if (activePersonaId === id) set({ activePersonaId: null })
    await get().loadPersonas()
  },
}))
