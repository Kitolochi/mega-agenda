import https from 'https'

const SYSTEM_PROMPT = `You are a rhetorical advisor specialized in crafting tweets (max 280 characters). You know tweet-specific techniques: hooks, antithesis, tricolon, anaphora, rhetorical questions, punchy one-liners, strategic line breaks, and provocative framing.

Rules:
- Always return concrete tweet text, not vague advice
- Every tweet suggestion must be under 280 characters
- Wrap each tweet option in backticks so it can be extracted
- Be direct and specific in your analysis
- When brainstorming, vary the rhetorical approach across options`

function callClaudeWithMessages(
  apiKey: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages
    })

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            resolve(parsed.content?.[0]?.text || 'No response generated')
          }
        } catch {
          reject(new Error('Failed to parse API response'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

export async function brainstormTweet(
  apiKey: string,
  topic: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const messages = [
    ...history,
    {
      role: 'user',
      content: `Brainstorm 3-5 tweet options about: "${topic}"

For each option, use a different rhetorical approach (e.g., bold claim, question hook, contrarian take, storytelling, data-driven). Label each with its approach and wrap the tweet text in backticks.`
    }
  ]
  return callClaudeWithMessages(apiKey, messages, SYSTEM_PROMPT)
}

export async function refineTweet(
  apiKey: string,
  currentText: string,
  instruction: string,
  history: { role: string; content: string }[]
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
  return callClaudeWithMessages(apiKey, messages, SYSTEM_PROMPT)
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
  return callClaudeWithMessages(apiKey, messages, SYSTEM_PROMPT)
}
