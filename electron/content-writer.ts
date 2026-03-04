import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import { callLLMWithWebSearch, streamLLM } from './llm'

// Load voice research at module init
let voiceResearch = ''
try {
  voiceResearch = fs.readFileSync(
    path.join('C:', 'Users', 'chris', 'blueprint-output', 'superseed-content-agent', 'voice-research.md'),
    'utf-8'
  )
} catch {
  console.warn('[content-writer] Could not load voice-research.md')
}

const CONTENT_TYPE_INSTRUCTIONS: Record<string, string> = {
  tweet: 'Write a single tweet (max 280 characters). Punchy, no hashtags, 1-2 emojis max. Use the brand emoji 🌱 when appropriate.',
  thread: 'Write a Twitter/X thread of 3-8 tweets. Each tweet max 280 chars. Start with a strong hook. End with a CTA. Use "1/" numbering. Cliffhangers between posts.',
  blog_post: 'Write a blog post (800-1500 words). Use markdown formatting. Structure: hook → problem → mechanism → vision → CTA. Use short-long sentence rhythm.',
  article: 'Write a long-form article (1500-3000 words). Deep technical content with accessible entry points. Use headers, subheaders. Progressive disclosure of complexity.',
  discord_post: 'Write a Discord community post (200-500 words). More casual tone, use bullet points, emojis OK. Community-first framing. End with engagement question.',
  newsletter: 'Write a newsletter edition (500-1000 words). Personal "we" voice. Mix of updates + insight. Clear sections with headers. Conversational but informative.',
}

const BASE_SYSTEM_PROMPT = `You are Superseed's content writer. You write content that matches Superseed's brand voice precisely.

${voiceResearch}

RULES:
- Never use hype language, ponzi comparisons, or VC-friendly framing
- Never make vaporware promises
- Use "we" for team perspective, "you" for reader
- Ground bold claims in concrete mechanics
- Use the brand emoji 🌱 sparingly
- No hashtags on Twitter content
- Be a confident realist: bold claims + honest caveats`

// Abort controllers
let researchAbortController: { abort: () => void } | null = null
let draftAbortController: { abort: () => void } | null = null

export function researchTopic(
  mainWindow: BrowserWindow,
  draftId: string,
  topic: string
): void {
  // Abort any existing research
  if (researchAbortController) {
    researchAbortController.abort()
    researchAbortController = null
  }

  const researchPrompt = `Research this topic in the context of Superseed, DeFi, and crypto: "${topic}"

Find recent news, data points, and relevant context. Then produce:

1. **Key Findings** — 3-5 bullet points of the most relevant recent information
2. **Content Outline** — 5-7 bullet points for content about this topic from Superseed's perspective
3. **Talking Points** — 2-3 unique angles or contrarian takes that align with Superseed's voice

Focus on facts, numbers, and concrete details. If the topic relates to Superseed's products (self-repaying loans, Supercollateral, SuperCDP, Supermarket, Proof of Repayment), include relevant product context.`

  callLLMWithWebSearch({
    prompt: researchPrompt,
    system: BASE_SYSTEM_PROMPT,
    maxTokens: 4096,
    tier: 'primary',
    timeout: 120000,
    maxSearches: 5,
  }).then((result) => {
    mainWindow.webContents.send('content-research-chunk', { draftId, text: result })
    mainWindow.webContents.send('content-research-end', { draftId })
  }).catch((err) => {
    mainWindow.webContents.send('content-research-error', { draftId, error: err.message || 'Research failed' })
  })
}

export function abortResearch(): void {
  if (researchAbortController) {
    researchAbortController.abort()
    researchAbortController = null
  }
}

export function streamContentDraft(
  mainWindow: BrowserWindow,
  draftId: string,
  messages: { role: string; content: string }[],
  contentType: string
): void {
  // Abort any existing draft stream
  if (draftAbortController) {
    draftAbortController.abort()
    draftAbortController = null
  }

  const typeInstruction = CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS.tweet

  const system = `${BASE_SYSTEM_PROMPT}

FORMAT INSTRUCTIONS:
${typeInstruction}

Write the content directly. Do not include meta-commentary like "Here's a tweet:" — just output the content itself.`

  draftAbortController = streamLLM(
    {
      messages,
      system,
      maxTokens: contentType === 'article' ? 8192 : 4096,
      tier: 'primary',
      timeout: 120000,
    },
    {
      onData: (text) => {
        mainWindow.webContents.send('content-stream-chunk', { draftId, text })
      },
      onEnd: () => {
        mainWindow.webContents.send('content-stream-end', { draftId })
        draftAbortController = null
      },
      onError: (error) => {
        mainWindow.webContents.send('content-stream-error', { draftId, error })
        draftAbortController = null
      },
    }
  )
}

export function abortDraft(): void {
  if (draftAbortController) {
    draftAbortController.abort()
    draftAbortController = null
  }
}
