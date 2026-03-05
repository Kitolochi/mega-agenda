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
  tweet: `Write 5 tweet variations (max 280 chars each). Each MUST use a different rhetorical device.

VOICE — Alex Hormozi meets crypto:
- Write at a 5th-grade reading level. If a 12-year-old can't understand it, rewrite it.
- Zero jargon. No "DeFi primitives", "yield optimization", "collateralization ratios", "protocol mechanics", "liquidity provision". Say what things DO in plain English.
- Short sentences. Punchy. Like this.
- Speak to the pain or desire directly: debt stress, wanting passive income, feeling ripped off by banks.
- Use concrete numbers and specifics over vague claims. "$10,000 loan" beats "your loan". "3 months" beats "over time".
- Contrarian but logical — challenge what everyone assumes, then show why the alternative is obvious.
- Pattern interrupt the feed. First 5 words decide if they read the rest.
- No buzzwords, no "revolutionary", no "innovative", no "paradigm shift", no "ecosystem".
- Talk like a smart friend explaining something at a bar, not a whitepaper.

RHETORICAL TOOLKIT — pick one per variation:
- Antithesis: juxtapose two opposites ("Banks charge you interest. We pay it for you.")
- Tricolon: three-part rhythm ("Borrow. Wait. Get repaid.")
- Question-as-hook: provocative question ("What if your loan just... paid itself off?")
- Setup→Twist: flip conventional wisdom ("Everyone says debt is bad. What if your debt made you money?")
- One-liner: single devastating sentence ("Your loan is paying itself off while you sleep.")
- Analogy: unexpected everyday comparison ("It's like a gym membership that works out FOR you.")
- Future-as-present: state the vision as fact ("Your loan is repaying itself right now.")
- Contrast: before/after, old way/new way ("Old way: pay interest. New way: earn it.")
- Direct address: talk straight to one person ("You're paying your bank's electric bill. Stop.")
- Story-in-a-sentence: micro-narrative ("Took out a loan. Didn't pay it back. It paid itself. True story.")

ENGAGEMENT STRATEGY — tag each variation:
- 💬 Reply-bait: provokes opinions, hot takes, "agree or disagree?" energy
- 🔁 RT-magnet: quotable, makes the sharer look smart for amplifying
- 💾 Save-worthy: insight people bookmark for later
- 👀 Scroll-stopper: pattern-interrupts the feed, makes you stop and re-read
- 🧵 Thread-starter: leaves enough unsaid that replies beg for more

CONSTRAINTS:
- 280 characters MAX per variation. Count carefully.
- No hashtags. Zero.
- 0-2 emojis max. 🌱 when on-brand.
- Every word must earn its place. Cut ruthlessly.
- Lead with the most surprising or contrarian angle.
- End with tension, curiosity, or a mic-drop.
- If you catch yourself writing a word a normal person wouldn't say out loud, delete it.

OUTPUT FORMAT (follow exactly):
---
**1. [Device Name]**
[tweet text]
_[engagement tag] · [X/280 chars] · Best when: [one-line posting context]_

**2. [Device Name]**
...
---

Generate 5 variations, each a genuinely different angle AND engagement strategy on the topic.`,
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
