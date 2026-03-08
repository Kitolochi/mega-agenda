import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import { callLLM, callLLMWithWebSearch, streamLLM } from './llm'
import { getTwitterSettings, updateContentDraftScores } from './database'
import { fetchAllLists } from './twitter'

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

// Top-performing tweet cache (30-min TTL)
let topTweetCache: { tweets: string; fetchedAt: number } | null = null
const CACHE_TTL = 30 * 60 * 1000

async function getTopPerformingTweets(): Promise<string> {
  if (topTweetCache && Date.now() - topTweetCache.fetchedAt < CACHE_TTL) {
    return topTweetCache.tweets
  }

  try {
    const settings = getTwitterSettings()
    if (!settings.bearerToken || !settings.listIds?.length) {
      return ''
    }

    const allTweets = await fetchAllLists(settings.bearerToken, settings.listIds)
    if (!allTweets.length) return ''

    // Score by engagement: retweets*3 + likes*2 + replies*1
    const scored = allTweets
      .map(t => ({
        ...t,
        engagementScore: (t.likeCount * 2) + (t.retweetCount * 3) + (t.replyCount * 1)
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5)

    const formatted = scored
      .map((t, i) => `${i + 1}. "@${t.authorUsername}: ${t.text.replace(/\n/g, ' ')}" — ${t.likeCount} likes, ${t.retweetCount} RTs`)
      .join('\n')

    topTweetCache = { tweets: formatted, fetchedAt: Date.now() }
    console.log(`[content-writer] Top tweets loaded: ${scored.length}`)
    return formatted
  } catch (err: any) {
    console.warn('[content-writer] Failed to fetch top tweets:', err.message)
    return ''
  }
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
- Talk like a smart friend explaining something at a bar, not a whitepaper.

BANNED PHRASES — never use these AI-isms or marketing clichés:
"flips the script", "game-changer", "revolutionary", "innovative", "paradigm shift", "ecosystem", "leverage", "unlock", "reimagine", "disrupt", "empower", "supercharge", "deep dive", "double down", "at the end of the day", "let that sink in", "here's the thing", "hot take", "unpopular opinion", "this is huge", "not financial advice", "buckle up", "strap in", "mind-blowing", "groundbreaking", "cutting-edge", "next-level", "best-in-class", "world-class", "seamless", "robust", "scalable", "synergy", "holistic", "landscape", "navigate", "space" (as in "the crypto space"), "journey", "delve", "foster", "harness", "pivotal", "advent", "realm", "interplay", "multifaceted", "ever-evolving", "in today's world", "it's worth noting".
If you catch yourself writing any of these, delete and use a normal word instead.

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

function scoreTweets(mainWindow: BrowserWindow, draftId: string, tweetContent: string): void {
  const scoringPrompt = `You are a ruthlessly honest social media strategist. Score each tweet variation on three dimensions (1-10 scale). Be decisive — most tweets are mediocre (4-6). Only give 8+ if it genuinely stops the scroll. Don't be generous.

SCORING RUBRIC:
- Hook (1-10): Does the first line stop the scroll? 10 = impossible to ignore, 1 = generic opener. Most hooks are a 5.
- Clarity (1-10): Would someone who never heard of crypto instantly understand? 10 = crystal clear to a 12-year-old, 1 = insider jargon soup.
- Viral (1-10): Would someone retweet this to look smart? 10 = instantly quotable, screenshot-worthy. 1 = nobody shares this.

IMPORTANT: Use the FULL range. A 7 is genuinely good. An 8 is excellent. A 9-10 is rare. Don't cluster everything at 7-8.

Respond ONLY with valid JSON array using double quotes, no markdown fences:
[{"index": 1, "hook": N, "clarity": N, "viral": N}, ...]

TWEETS TO SCORE:
${tweetContent}`

  callLLM({
    prompt: scoringPrompt,
    tier: 'fast',
    maxTokens: 1024,
    timeout: 45000,
  }).then((result) => {
    try {
      console.log('[content-writer] Score response length:', result.length, 'chars')
      let scores: { index: number; hook: number; clarity: number; viral: number }[] = []

      // Try JSON.parse first (most reliable)
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].hook !== undefined) {
            scores = parsed.map((s: any) => ({
              index: Number(s.index),
              hook: Number(s.hook),
              clarity: Number(s.clarity),
              viral: Number(s.viral),
            }))
          }
        }
      } catch { /* fall through to regex */ }

      // Fallback: regex extraction
      if (scores.length === 0) {
        const scorePattern = /index['":\s]*(\d+)[^}]*hook['":\s]*(\d+)[^}]*clarity['":\s]*(\d+)[^}]*viral['":\s]*(\d+)/gi
        let match
        while ((match = scorePattern.exec(result)) !== null) {
          scores.push({
            index: parseInt(match[1]),
            hook: parseInt(match[2]),
            clarity: parseInt(match[3]),
            viral: parseInt(match[4]),
          })
        }
      }

      if (scores.length > 0) {
        mainWindow.webContents.send('content-scores-ready', { draftId, scores })
        try { updateContentDraftScores(draftId, scores) } catch (e: any) {
          console.warn('[content-writer] Failed to persist scores:', e.message)
        }
      } else {
        throw new Error('No scores found in response')
      }
    } catch (parseErr: any) {
      console.warn('[content-writer] Failed to parse tweet scores:', parseErr.message, '\nRaw:', result.slice(0, 500))
      mainWindow.webContents.send('content-scores-error', { draftId, error: 'Failed to parse scores' })
    }
  }).catch((err) => {
    console.warn('[content-writer] Tweet scoring failed:', err.message)
    mainWindow.webContents.send('content-scores-error', { draftId, error: err.message || 'Scoring failed' })
  })
}

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

export async function streamContentDraft(
  mainWindow: BrowserWindow,
  draftId: string,
  messages: { role: string; content: string }[],
  contentType: string
): Promise<void> {
  // Abort any existing draft stream
  if (draftAbortController) {
    draftAbortController.abort()
    draftAbortController = null
  }

  const typeInstruction = CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS.tweet

  // Fetch top-performing tweets for intelligence injection
  const topTweets = contentType === 'tweet' ? await getTopPerformingTweets() : ''

  const tweetOverride = contentType === 'tweet' ? `

CRITICAL OVERRIDE FOR TWEETS:
The voice research above describes Superseed's general brand voice. For tweets, IGNORE the language style and vocabulary from the voice research. Use it ONLY for factual context (what products exist, what they do, roadmap facts).

DO NOT use these words/phrases in tweets: "financial primitive", "protocol revenue", "flywheel", "TVL", "composable", "ecosystem", "infrastructure", "onchain individual", "governance", "OP Stack", "Superchain", "collateralization", "liquidity", "yield optimization", "DeFi", "stablecoin-focused money market", "revenue-generating", "tokenomics".

INSTEAD translate everything into plain English:
- "protocol revenue" → "the money the app makes"
- "self-repaying loans" → "loans that pay themselves off" (this one is already simple enough)
- "TVL" → "money people have deposited"
- "yield" → "earnings" or "returns"
- "collateral" → "what you put up"
- "DeFi" → just describe what it does, don't label the category
- "stablecoin" → "digital dollar" or just "dollar"

Write like you're texting a smart friend who knows nothing about crypto. Every tweet should be instantly understandable by someone who has never heard of blockchain.

ALSO BANNED — AI-isms and cliché phrases. NEVER use: "flips the script", "game-changer", "let that sink in", "here's the thing", "hot take", "unpopular opinion", "buckle up", "mind-blowing", "groundbreaking", "next-level", "seamless", "journey", "delve", "navigate", "landscape", "reimagine", "unlock", "empower", "supercharge", "deep dive", "ever-evolving", "it's worth noting", "in today's world". Write like a real person, not an AI.
${topTweets ? `\nHIGH-ENGAGEMENT REFERENCE TWEETS (study their structure, not their topic):\n${topTweets}\nApply similar hooks, rhythm, and specificity to Superseed content. Do NOT copy topics — only learn from structure.\n` : ''}` : ''

  const system = `${BASE_SYSTEM_PROMPT}

FORMAT INSTRUCTIONS:
${typeInstruction}
${tweetOverride}

Write the content directly. Do not include meta-commentary like "Here's a tweet:" — just output the content itself.`

  let draftText = ''

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
        draftText += text
        mainWindow.webContents.send('content-stream-chunk', { draftId, text })
      },
      onEnd: () => {
        mainWindow.webContents.send('content-stream-end', { draftId })
        draftAbortController = null
        if (contentType === 'tweet') {
          scoreTweets(mainWindow, draftId, draftText)
        }
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
