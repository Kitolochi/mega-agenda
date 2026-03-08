import fs from 'fs'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { callLLM, callLLMWithWebSearch, streamLLM } from './llm'
import { getTwitterSettings, updateContentDraftScores, addScoreSnapshot, getScoreSnapshots, getAllScoredDrafts, getTweetPatterns, saveTweetPatterns } from './database'
import { fetchAllLists } from './twitter'

// Load voice research from app data dir (user-configurable)
let voiceResearch = ''
try {
  const appDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'mega-agenda')
  const voicePath = path.join(appDataDir, 'voice-research.md')
  if (fs.existsSync(voicePath)) {
    voiceResearch = fs.readFileSync(voicePath, 'utf-8')
  }
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

VOICE:
- Write at a 5th-grade reading level. If a 12-year-old can't understand it, rewrite it.
- Zero jargon. Say what things DO in plain English.
- Short sentences. Punchy. Like this.
- Speak to the pain or desire directly.
- Use concrete numbers and specifics over vague claims.
- Contrarian but logical — challenge what everyone assumes, then show why the alternative is obvious.
- Pattern interrupt the feed. First 5 words decide if they read the rest.
- Talk like a smart friend explaining something at a bar, not a whitepaper.

BANNED PHRASES — never use these AI-isms or marketing clichés:
"flips the script", "game-changer", "revolutionary", "innovative", "paradigm shift", "ecosystem", "leverage", "unlock", "reimagine", "disrupt", "empower", "supercharge", "deep dive", "double down", "at the end of the day", "let that sink in", "here's the thing", "hot take", "unpopular opinion", "this is huge", "not financial advice", "buckle up", "strap in", "mind-blowing", "groundbreaking", "cutting-edge", "next-level", "best-in-class", "world-class", "seamless", "robust", "scalable", "synergy", "holistic", "landscape", "navigate", "space" (as in "the crypto space"), "journey", "delve", "foster", "harness", "pivotal", "advent", "realm", "interplay", "multifaceted", "ever-evolving", "in today's world", "it's worth noting".
If you catch yourself writing any of these, delete and use a normal word instead.

RHETORICAL TOOLKIT — pick one per variation:
- Antithesis: juxtapose two opposites
- Tricolon: three-part rhythm
- Question-as-hook: provocative question
- Setup→Twist: flip conventional wisdom
- One-liner: single devastating sentence
- Analogy: unexpected everyday comparison
- Future-as-present: state the vision as fact
- Contrast: before/after, old way/new way
- Direct address: talk straight to one person
- Story-in-a-sentence: micro-narrative

ENGAGEMENT STRATEGY — tag each variation:
- 💬 Reply-bait: provokes opinions, hot takes, "agree or disagree?" energy
- 🔁 RT-magnet: quotable, makes the sharer look smart for amplifying
- 💾 Save-worthy: insight people bookmark for later
- 👀 Scroll-stopper: pattern-interrupts the feed, makes you stop and re-read
- 🧵 Thread-starter: leaves enough unsaid that replies beg for more

CONSTRAINTS:
- 280 characters MAX per variation. Count carefully.
- No hashtags. Zero.
- 0-2 emojis max.
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

const BASE_SYSTEM_PROMPT = `You are a content writer. You write content that matches the brand voice described below.

${voiceResearch}

RULES:
- Never use hype language or make vaporware promises
- Use "we" for team perspective, "you" for reader
- Ground bold claims in concrete mechanics
- No hashtags on Twitter content
- Be a confident realist: bold claims + honest caveats`

function scoreTweets(mainWindow: BrowserWindow, draftId: string, tweetContent: string, isAutoRefinement = false): void {
  callLLM({
    messages: [
      { role: 'user', content: `Score each tweet 1-10 on hook (scroll-stopping), clarity (instantly understandable), viral (would RT).

CALIBRATION ANCHORS — use these as reference points:
- 2: Reads like a press release. Corporate language, no personality. "We are excited to announce..."
- 4: Has an idea but buried in jargon or weak framing. Skippable.
- 6: Decent but forgettable. You'd scroll past without pausing.
- 8: Would genuinely retweet this. Strong hook, clear point, memorable.
- 10: Bet money this goes viral. Perfect hook, devastating clarity, instant share impulse.

Most tweets are 4-6. Be honest — 8+ is rare.

For each tweet, also provide:
- "feedback": one sentence explaining the score (what works, what doesn't)
- "strengths": array of 1-3 specific structural strengths (e.g. "concrete dollar amount", "clean antithesis")
- "weaknesses": array of 0-3 specific weaknesses (e.g. "generic opener", "assumes DeFi knowledge")

Return a JSON array.

TWEETS:
${tweetContent}` },
      { role: 'assistant', content: '[{"index":1,' }
    ],
    tier: 'primary',
    maxTokens: 2048,
    timeout: 60000,
  }).then((rawResult) => {
    const result = '[{"index":1,' + rawResult
    try {
      console.log('[content-writer] Score raw:', result.slice(0, 500))
      let scores: { index: number; hook: number; clarity: number; viral: number; feedback?: string; strengths?: string[]; weaknesses?: string[] }[] = []

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
              feedback: typeof s.feedback === 'string' ? s.feedback : undefined,
              strengths: Array.isArray(s.strengths) ? s.strengths.map(String) : undefined,
              weaknesses: Array.isArray(s.weaknesses) ? s.weaknesses.map(String) : undefined,
            }))
          }
        }
      } catch { /* fall through to regex */ }

      // Fallback: regex extraction (no feedback fields — just numbers)
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
        console.log('[content-writer] Parsed', scores.length, 'scores')
        mainWindow.webContents.send('content-scores-ready', { draftId, scores })
        try { updateContentDraftScores(draftId, scores) } catch (e: any) {
          console.warn('[content-writer] Failed to persist scores:', e.message)
        }
        recordScoreSnapshot(scores)

        // Auto-refine weak tweets (one pass only)
        if (!isAutoRefinement) {
          const overallAvg = scores.reduce((sum, s) => sum + (s.hook + s.clarity + s.viral) / 3, 0) / scores.length
          const weakTweets = scores.filter(s => (s.hook + s.clarity + s.viral) / 3 < 6)
          if (overallAvg < 7 && weakTweets.length > 0) {
            console.log(`[content-writer] Auto-refine: avg=${overallAvg.toFixed(1)}, ${weakTweets.length} weak tweets`)
            mainWindow.webContents.send('content-auto-refine-start', { draftId, weakCount: weakTweets.length, avgScore: Math.round(overallAvg * 10) / 10 })
            autoRefineTweets(mainWindow, draftId, tweetContent, scores)
          }
        }

        scoringCallCount++
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

// Track scoring calls for periodic pattern extraction
let scoringCallCount = 0

function recordScoreSnapshot(scores: { index: number; hook: number; clarity: number; viral: number }[]): void {
  try {
    const today = new Date().toISOString().split('T')[0]
    const existing = getScoreSnapshots()
    const todaySnap = existing.find(s => s.date === today)

    const avgHook = scores.reduce((s, x) => s + x.hook, 0) / scores.length
    const avgClarity = scores.reduce((s, x) => s + x.clarity, 0) / scores.length
    const avgViral = scores.reduce((s, x) => s + x.viral, 0) / scores.length
    const avgOverall = (avgHook + avgClarity + avgViral) / 3
    const above8 = scores.filter(s => (s.hook + s.clarity + s.viral) / 3 >= 8).length
    const below5 = scores.filter(s => (s.hook + s.clarity + s.viral) / 3 < 5).length

    if (todaySnap) {
      // Running average for multiple generations in one day
      const prevWeight = todaySnap.draftsScored
      const newWeight = 1
      const totalWeight = prevWeight + newWeight
      addScoreSnapshot({
        date: today,
        draftsScored: todaySnap.draftsScored + 1,
        tweetsScored: todaySnap.tweetsScored + scores.length,
        avgHook: Math.round(((todaySnap.avgHook * prevWeight + avgHook * newWeight) / totalWeight) * 10) / 10,
        avgClarity: Math.round(((todaySnap.avgClarity * prevWeight + avgClarity * newWeight) / totalWeight) * 10) / 10,
        avgViral: Math.round(((todaySnap.avgViral * prevWeight + avgViral * newWeight) / totalWeight) * 10) / 10,
        avgOverall: Math.round(((todaySnap.avgOverall * prevWeight + avgOverall * newWeight) / totalWeight) * 10) / 10,
        above8Count: todaySnap.above8Count + above8,
        below5Count: todaySnap.below5Count + below5,
      })
    } else {
      addScoreSnapshot({
        date: today,
        draftsScored: 1,
        tweetsScored: scores.length,
        avgHook: Math.round(avgHook * 10) / 10,
        avgClarity: Math.round(avgClarity * 10) / 10,
        avgViral: Math.round(avgViral * 10) / 10,
        avgOverall: Math.round(avgOverall * 10) / 10,
        above8Count: above8,
        below5Count: below5,
      })
    }
    console.log(`[content-writer] Score snapshot recorded for ${today}`)
  } catch (e: any) {
    console.warn('[content-writer] Failed to record score snapshot:', e.message)
  }
}

function parseTweetBlocksServer(content: string): { index: number; text: string }[] {
  const blocks = content.split(/(?=\*\*\d+\.\s)/).filter(b => b.trim())
  return blocks.map((block, i) => {
    const lines = block.trim().split('\n').filter(l => l.trim())
    const tweetLines = lines.filter(
      l => !l.match(/^\*\*\d+\./) && !l.match(/^\d+\/280/) && !l.match(/^---/) && !l.match(/^_.*_$/)
    )
    return { index: i + 1, text: tweetLines.join('\n').trim() }
  }).filter(b => b.text.length > 0)
}

function autoRefineTweets(
  mainWindow: BrowserWindow,
  draftId: string,
  originalContent: string,
  scores: { index: number; hook: number; clarity: number; viral: number; feedback?: string; strengths?: string[]; weaknesses?: string[] }[]
): void {
  const weakTweets = scores.filter(s => (s.hook + s.clarity + s.viral) / 3 < 6)
  if (weakTweets.length === 0) return

  const weakIndices = weakTweets.map(s => s.index)
  const feedbackSection = weakTweets.map(s =>
    `Tweet ${s.index}: Hook=${s.hook}, Clarity=${s.clarity}, Viral=${s.viral}${s.feedback ? ` — ${s.feedback}` : ''}${s.weaknesses?.length ? `\n  Weaknesses: ${s.weaknesses.join(', ')}` : ''}`
  ).join('\n')

  const messages = [
    { role: 'user', content: `Here are 5 tweet variations I wrote:\n\n${originalContent}` },
    { role: 'assistant', content: originalContent },
    { role: 'user', content: `Tweets ${weakIndices.join(', ')} scored poorly. Here's the scoring feedback:\n\n${feedbackSection}\n\nRewrite ONLY the weak tweets (${weakIndices.join(', ')}). Keep the strong ones exactly as they are. Output all 5 in the same format.` },
  ]

  let refinedText = ''

  streamLLM(
    {
      messages,
      system: `${BASE_SYSTEM_PROMPT}\n\nFORMAT INSTRUCTIONS:\n${CONTENT_TYPE_INSTRUCTIONS.tweet}\n\nYou are refining specific weak tweets based on scorer feedback. Keep strong tweets identical.`,
      maxTokens: 4096,
      tier: 'primary',
      timeout: 120000,
    },
    {
      onData: (text) => {
        refinedText += text
        mainWindow.webContents.send('content-stream-chunk', { draftId, text })
      },
      onEnd: () => {
        mainWindow.webContents.send('content-stream-end', { draftId })
        // Re-score the refined version (isAutoRefinement=true prevents infinite loop)
        scoreTweets(mainWindow, draftId, refinedText, true)
      },
      onError: (error) => {
        mainWindow.webContents.send('content-stream-error', { draftId, error })
      },
    }
  )
}

export async function extractPatterns(): Promise<any[]> {
  const allDrafts = getAllScoredDrafts()
  if (allDrafts.length < 3) {
    console.log('[content-writer] Not enough scored drafts for pattern extraction:', allDrafts.length)
    return []
  }

  // Separate high and low scoring tweets
  const highTweets: { text: string; avgScore: number; feedback?: string }[] = []
  const lowTweets: { text: string; avgScore: number; feedback?: string }[] = []

  for (const draft of allDrafts) {
    if (!draft.scores || !draft.content) continue
    const blocks = parseTweetBlocksServer(draft.content)
    for (const score of draft.scores) {
      const avg = (score.hook + score.clarity + score.viral) / 3
      const block = blocks.find(b => b.index === score.index)
      if (!block) continue
      const entry = { text: block.text.slice(0, 280), avgScore: Math.round(avg * 10) / 10, feedback: (score as any).feedback }
      if (avg >= 7.5) highTweets.push(entry)
      else if (avg < 5) lowTweets.push(entry)
    }
  }

  if (highTweets.length === 0 && lowTweets.length === 0) {
    console.log('[content-writer] No extreme-scored tweets for pattern extraction')
    return []
  }

  const prompt = `Analyze these tweets and identify STRUCTURAL patterns (not topic-specific) that explain why some scored high and others low.

HIGH-SCORING TWEETS (avg >= 7.5):
${highTweets.slice(0, 10).map((t, i) => `${i + 1}. "${t.text}" (avg: ${t.avgScore}${t.feedback ? `, feedback: ${t.feedback}` : ''})`).join('\n')}

LOW-SCORING TWEETS (avg < 5):
${lowTweets.slice(0, 10).map((t, i) => `${i + 1}. "${t.text}" (avg: ${t.avgScore}${t.feedback ? `, feedback: ${t.feedback}` : ''})`).join('\n')}

For each pattern, identify:
- type: "positive" or "negative"
- pattern: structural description (e.g. "X vs Y contrast with concrete numbers", "generic opener with no hook")
- avgScore: typical score range
- exampleTweet: one example from the list above

Return a JSON array of pattern objects. Focus on structural/rhetorical patterns, NOT topic content.`

  try {
    const rawResult = await callLLM({
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: '[{"type":' }
      ],
      tier: 'primary',
      maxTokens: 2048,
      timeout: 60000,
    })

    const result = '[{"type":' + rawResult
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) return []

    const patterns = parsed.map((p: any) => ({
      id: Math.random().toString(36).slice(2, 10),
      type: p.type === 'positive' ? 'positive' : 'negative',
      pattern: String(p.pattern || ''),
      avgScore: Number(p.avgScore) || 0,
      occurrences: 1,
      exampleTweet: String(p.exampleTweet || '').slice(0, 280),
      extractedAt: new Date().toISOString(),
    }))

    saveTweetPatterns(patterns)
    console.log(`[content-writer] Extracted ${patterns.length} tweet patterns`)
    return patterns
  } catch (err: any) {
    console.warn('[content-writer] Pattern extraction failed:', err.message)
    return []
  }
}

export async function buildIntuitionSection(): Promise<string> {
  try {
    const allDrafts = getAllScoredDrafts()
    const patterns = getTweetPatterns()
    if (allDrafts.length === 0 && patterns.length === 0) return ''

    const sections: string[] = []
    sections.push('\n\nLEARNING FROM YOUR OWN HISTORY:')

    // Collect all scored tweets with their content
    const allScoredTweets: { text: string; avg: number; feedback?: string }[] = []
    for (const draft of allDrafts) {
      if (!draft.scores || !draft.content) continue
      const blocks = parseTweetBlocksServer(draft.content)
      for (const score of draft.scores) {
        const avg = (score.hook + score.clarity + score.viral) / 3
        const block = blocks.find(b => b.index === score.index)
        if (block) allScoredTweets.push({ text: block.text.slice(0, 280), avg, feedback: (score as any).feedback })
      }
    }

    // Top 3 high-scoring
    const highSorted = [...allScoredTweets].sort((a, b) => b.avg - a.avg).slice(0, 3)
    if (highSorted.length > 0) {
      sections.push('\nYour TOP-PERFORMING tweets (emulate these structures):')
      highSorted.forEach((t, i) => {
        sections.push(`${i + 1}. "${t.text}" — avg ${t.avg.toFixed(1)}${t.feedback ? ` (${t.feedback})` : ''}`)
      })
    }

    // Bottom 3 low-scoring
    const lowSorted = [...allScoredTweets].sort((a, b) => a.avg - b.avg).slice(0, 3)
    if (lowSorted.length > 0) {
      sections.push('\nYour WORST-PERFORMING tweets (avoid these patterns):')
      lowSorted.forEach((t, i) => {
        sections.push(`${i + 1}. "${t.text}" — avg ${t.avg.toFixed(1)}${t.feedback ? ` (${t.feedback})` : ''}`)
      })
    }

    // Extracted patterns
    const positivePatterns = patterns.filter(p => p.type === 'positive')
    const negativePatterns = patterns.filter(p => p.type === 'negative')
    if (positivePatterns.length > 0) {
      sections.push('\nPATTERNS THAT WORK:')
      positivePatterns.slice(0, 5).forEach(p => sections.push(`- ${p.pattern}`))
    }
    if (negativePatterns.length > 0) {
      sections.push('\nPATTERNS TO AVOID:')
      negativePatterns.slice(0, 5).forEach(p => sections.push(`- ${p.pattern}`))
    }

    return sections.join('\n')
  } catch (e: any) {
    console.warn('[content-writer] Failed to build intuition section:', e.message)
    return ''
  }
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

  const researchPrompt = `Research this topic: "${topic}"

Find recent news, data points, and relevant context. Then produce:

1. **Key Findings** — 3-5 bullet points of the most relevant recent information
2. **Content Outline** — 5-7 bullet points for content about this topic
3. **Talking Points** — 2-3 unique angles or contrarian takes

Focus on facts, numbers, and concrete details.`

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

  // Build intuition section from score history (only for tweets)
  const intuitionSection = contentType === 'tweet' ? await buildIntuitionSection() : ''

  const tweetOverride = contentType === 'tweet' ? `

CRITICAL OVERRIDE FOR TWEETS:
For tweets, use the voice research ONLY for factual context. Write in plain, accessible language.

Translate all jargon into plain English. Every tweet should be instantly understandable by someone with no domain expertise.

BANNED — AI-isms and cliché phrases. NEVER use: "flips the script", "game-changer", "let that sink in", "here's the thing", "hot take", "unpopular opinion", "buckle up", "mind-blowing", "groundbreaking", "next-level", "seamless", "journey", "delve", "navigate", "landscape", "reimagine", "unlock", "empower", "supercharge", "deep dive", "ever-evolving", "it's worth noting", "in today's world". Write like a real person, not an AI.
${topTweets ? `\nHIGH-ENGAGEMENT REFERENCE TWEETS (study their structure, not their topic):\n${topTweets}\nApply similar hooks, rhythm, and specificity. Do NOT copy topics — only learn from structure.\n` : ''}${intuitionSection}` : ''

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
