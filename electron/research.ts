import https from 'https'
import fs from 'fs'
import path from 'path'
import { tavily } from '@tavily/core'

interface RoadmapGoal {
  id: string
  title: string
  description: string
  category: string
  research_questions: string[]
  guidance_needed: string[]
}

function callClaudeResearch(apiKey: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
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
            resolve(parsed.content?.[0]?.text || 'No analysis generated')
          }
        } catch {
          reject(new Error('Failed to parse API response'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

export async function researchGoal(
  goal: RoadmapGoal,
  claudeApiKey: string,
  tavilyApiKey: string
): Promise<{ report: string; filePath: string }> {
  const client = tavily({ apiKey: tavilyApiKey })

  const allQuestions = [
    ...goal.research_questions,
    ...goal.guidance_needed.map(g => `How to: ${g}`)
  ]

  if (allQuestions.length === 0) {
    throw new Error('No research questions or guidance needs found for this goal')
  }

  // Search each question via Tavily
  let contextParts: string[] = []

  for (const question of allQuestions) {
    try {
      const searchResult = await client.search(question, {
        searchDepth: 'advanced',
        maxResults: 10,
      })

      if (searchResult.results && searchResult.results.length > 0) {
        const resultSummary = searchResult.results.slice(0, 8).map((r: any, i: number) =>
          `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content?.slice(0, 300) || ''}`
        ).join('\n\n')
        contextParts.push(`### Search: "${question}"\n\n${resultSummary}`)
      }

      // Extract content from top URLs
      const topUrls = searchResult.results?.slice(0, 5).map((r: any) => r.url).filter(Boolean) || []
      if (topUrls.length > 0) {
        try {
          const extracted = await client.extract(topUrls)
          if (extracted.results && extracted.results.length > 0) {
            const extractSummary = extracted.results.map((r: any) =>
              `[Extracted from ${r.url}]\n${(r.rawContent || '').slice(0, 500)}`
            ).join('\n\n')
            contextParts.push(`### Extracted content for: "${question}"\n\n${extractSummary}`)
          }
        } catch {
          // Extract can fail for some URLs — continue without it
        }
      }
    } catch (err: any) {
      contextParts.push(`### Search: "${question}"\n\n_Search failed: ${err.message}_`)
    }
  }

  const fullContext = contextParts.join('\n\n---\n\n')

  // Analyze with Claude
  const analysisPrompt = `You are a research analyst helping someone achieve a life goal. Analyze the search results below and provide a comprehensive research report.

## Goal: ${goal.title}
${goal.description ? `\nDescription: ${goal.description}` : ''}
Category: ${goal.category}

## Research Questions:
${goal.research_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## Guidance Needed:
${goal.guidance_needed.map((g, i) => `${i + 1}. ${g}`).join('\n')}

## Search Results & Extracted Content:

${fullContext}

---

Please provide a structured report with:
1. **Executive Summary** — 2-3 sentence overview of findings
2. **Answers to Research Questions** — Address each question with evidence from the search results
3. **Guidance & Recommendations** — Practical advice for each guidance need
4. **Key Resources** — Most useful links found
5. **Next Steps** — Concrete action items based on the research

Be specific, cite sources where possible, and focus on actionable insights.`

  const report = await callClaudeResearch(claudeApiKey, analysisPrompt)

  // Append to research report file
  const filePath = appendToResearchReport(goal.title, report)

  return { report, filePath }
}

function appendToResearchReport(goalTitle: string, report: string): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const claudeDir = path.join(homeDir, '.claude')
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true })
  }

  const filePath = path.join(claudeDir, 'roadmap-research.md')
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const section = `\n\n---\n\n# Research: ${goalTitle}\n_Generated: ${timestamp}_\n\n${report}\n`

  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, section, 'utf-8')
  } else {
    const header = '# Roadmap Research Reports\n\nAuto-generated research reports for life roadmap goals.\n'
    fs.writeFileSync(filePath, header + section, 'utf-8')
  }

  return filePath
}
