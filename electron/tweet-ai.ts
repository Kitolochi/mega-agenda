import { callLLM } from './llm'

interface TweetPersona {
  id: string
  name: string
  description: string
  exampleTweets: string[]
  isBuiltIn: boolean
  createdAt: string
}

const SYSTEM_PROMPT = `You are a rhetorical advisor specialized in crafting tweets (max 280 characters). You know tweet-specific techniques: hooks, antithesis, tricolon, anaphora, rhetorical questions, punchy one-liners, strategic line breaks, and provocative framing.

Rules:
- Always return concrete tweet text, not vague advice
- Every tweet suggestion must be under 280 characters
- Wrap each tweet option in backticks so it can be extracted
- Be direct and specific in your analysis
- When brainstorming, vary the rhetorical approach across options`

function buildSystemPrompt(persona?: TweetPersona): string {
  if (!persona) return SYSTEM_PROMPT
  const exampleLines = persona.exampleTweets.map(t => `- ${t}`).join('\n')
  return `${SYSTEM_PROMPT}

You are writing in the voice of: ${persona.name}
Style: ${persona.description}
Example tweets in this voice:
${exampleLines}
Maintain this voice consistently.`
}

export async function brainstormTweet(
  apiKey: string,
  topic: string,
  history: { role: string; content: string }[],
  persona?: TweetPersona
): Promise<string> {
  const messages = [
    ...history,
    {
      role: 'user',
      content: `Brainstorm 3-5 tweet options about: "${topic}"

For each option, use a different rhetorical approach (e.g., bold claim, question hook, contrarian take, storytelling, data-driven). Label each with its approach and wrap the tweet text in backticks.`
    }
  ]
  return callLLM({ messages, system: buildSystemPrompt(persona), tier: 'fast', maxTokens: 1500 })
}

export async function brainstormThread(
  apiKey: string,
  topic: string,
  history: { role: string; content: string }[],
  persona?: TweetPersona
): Promise<string> {
  const messages = [
    ...history,
    {
      role: 'user',
      content: `Create a Twitter thread (3-5 connected tweets) about: "${topic}"

Rules:
- Each tweet must be under 280 characters
- The first tweet should be a strong hook that makes people want to read the thread
- Each subsequent tweet should flow naturally from the previous one
- The last tweet should be a strong conclusion or call to action
- Wrap each tweet in backticks
- Number them (1/, 2/, etc.) before each backtick block
- Include brief transition notes between tweets explaining the narrative flow`
    }
  ]
  return callLLM({ messages, system: buildSystemPrompt(persona), tier: 'fast', maxTokens: 1500 })
}

export async function refineTweet(
  apiKey: string,
  currentText: string,
  instruction: string,
  history: { role: string; content: string }[],
  persona?: TweetPersona
): Promise<string> {
  const messages = [
    ...history,
    {
      role: 'user',
      content: `Here's my current tweet draft:
"${currentText}"

${instruction}

Return 2-3 improved versions, each wrapped in backticks. Briefly note what you changed in each.`
    }
  ]
  return callLLM({ messages, system: buildSystemPrompt(persona), tier: 'fast', maxTokens: 1500 })
}

export async function analyzeTweet(
  apiKey: string,
  text: string
): Promise<string> {
  const messages = [
    {
      role: 'user',
      content: `Analyze this tweet:
"${text}"

Rate each dimension 1-10:
- **Clarity**: Is the message instantly understandable?
- **Engagement**: Will people stop scrolling?
- **Rhetoric**: How well does it use persuasive techniques?

Then list any rhetorical devices used (or missing opportunities). Finally, suggest one concrete improvement wrapped in backticks.`
    }
  ]
  return callLLM({ messages, system: SYSTEM_PROMPT, tier: 'fast', maxTokens: 1500 })
}
