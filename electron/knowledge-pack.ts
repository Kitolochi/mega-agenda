import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getMemories } from './database'
import { embedBatch, cosineSimilarity } from './embeddings'
import { callLLM } from './llm'
import { kMeansClustering, selectOptimalK, computeClusterLabels } from './clustering'

// --- Types ---

export interface KnowledgeCluster {
  label: string
  summary: string
  facts: string[]
  memoryCount: number
}

export interface KnowledgePack {
  id: string
  createdAt: string
  overview: string
  clusters: KnowledgeCluster[]
  stats: {
    totalMemories: number
    totalFacts: number
    compressionRatio: number
    durationMs: number
  }
}

export interface CompressionProgress {
  phase: 'embedding' | 'dedup' | 'clustering' | 'summarizing' | 'extracting' | 'overview' | 'done'
  percent: number
  detail: string
}

// --- Storage ---

function getPackDir(): string {
  const dir = path.join(app.getPath('userData'), 'knowledge-packs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getIndexPath(): string {
  return path.join(getPackDir(), 'index.json')
}

export function getKnowledgePacks(): KnowledgePack[] {
  const indexPath = getIndexPath()
  if (!fs.existsSync(indexPath)) return []
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  } catch {
    return []
  }
}

export function saveKnowledgePack(pack: KnowledgePack): void {
  const packs = getKnowledgePacks()
  const idx = packs.findIndex(p => p.id === pack.id)
  if (idx >= 0) {
    packs[idx] = pack
  } else {
    packs.unshift(pack)
  }
  fs.writeFileSync(getIndexPath(), JSON.stringify(packs, null, 2), 'utf-8')
}

// --- Compression Pipeline ---

const DEDUP_THRESHOLD = 0.92

export async function compressKnowledgeNative(
  onProgress?: (progress: CompressionProgress) => void
): Promise<KnowledgePack> {
  const startTime = Date.now()
  const memories = getMemories()

  if (memories.length === 0) {
    throw new Error('No memories to compress')
  }

  // Phase 1: Embed all memories
  onProgress?.({ phase: 'embedding', percent: 5, detail: `Embedding ${memories.length} memories...` })
  const texts = memories.map(m => `${m.title}. ${m.content}`)
  const embeddings = await embedBatch(texts)

  // Filter out null embeddings
  const validPairs: { index: number; embedding: Float32Array; text: string }[] = []
  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i]) {
      validPairs.push({ index: i, embedding: embeddings[i]!, text: texts[i] })
    }
  }

  if (validPairs.length === 0) {
    throw new Error('Embedding model not ready. Please wait for model initialization.')
  }

  onProgress?.({ phase: 'embedding', percent: 20, detail: `Embedded ${validPairs.length}/${memories.length} memories` })

  // Phase 2: Deduplicate near-duplicates
  onProgress?.({ phase: 'dedup', percent: 25, detail: 'Removing near-duplicates...' })
  const dedupSet = new Set<number>()
  for (let i = 0; i < validPairs.length; i++) {
    if (dedupSet.has(i)) continue
    for (let j = i + 1; j < validPairs.length; j++) {
      if (dedupSet.has(j)) continue
      const sim = cosineSimilarity(validPairs[i].embedding, validPairs[j].embedding)
      if (sim >= DEDUP_THRESHOLD) {
        // Keep the one with higher importance or more content
        const memI = memories[validPairs[i].index]
        const memJ = memories[validPairs[j].index]
        if (memJ.importance > memI.importance || memJ.content.length > memI.content.length) {
          dedupSet.add(i)
        } else {
          dedupSet.add(j)
        }
      }
    }
  }

  const unique = validPairs.filter((_, i) => !dedupSet.has(i))
  onProgress?.({ phase: 'dedup', percent: 35, detail: `${unique.length} unique memories (removed ${dedupSet.size} duplicates)` })

  // Phase 3: Cluster
  onProgress?.({ phase: 'clustering', percent: 40, detail: 'Finding optimal clusters...' })
  const uniqueEmbeddings = unique.map(p => p.embedding)
  const optimalK = unique.length <= 3 ? 1 : selectOptimalK(uniqueEmbeddings, 2, Math.min(15, Math.floor(unique.length / 2)))
  const assignments = kMeansClustering(uniqueEmbeddings, optimalK)
  const clusterLabels = computeClusterLabels(unique.map(p => p.text), assignments)

  onProgress?.({ phase: 'clustering', percent: 50, detail: `Formed ${optimalK} knowledge clusters` })

  // Phase 4: Summarize each cluster via LLM
  onProgress?.({ phase: 'summarizing', percent: 55, detail: 'Summarizing clusters...' })
  const clusterGroups = new Map<number, typeof unique>()
  for (let i = 0; i < unique.length; i++) {
    const c = assignments[i]
    if (!clusterGroups.has(c)) clusterGroups.set(c, [])
    clusterGroups.get(c)!.push(unique[i])
  }

  const clusters: KnowledgeCluster[] = []
  let clusterIdx = 0
  const totalClusters = clusterGroups.size

  for (const [cIdx, members] of clusterGroups) {
    const pct = 55 + Math.round((clusterIdx / totalClusters) * 25)
    onProgress?.({ phase: 'summarizing', percent: pct, detail: `Summarizing cluster ${clusterIdx + 1}/${totalClusters}: ${clusterLabels[cIdx]}` })

    const memoryTexts = members.map(m => {
      const mem = memories[m.index]
      return `- [${mem.title}] ${mem.content}`
    }).join('\n')

    let summary: string
    let facts: string[]

    try {
      const response = await callLLM({
        system: 'You compress knowledge. Output ONLY valid JSON with no markdown fencing.',
        prompt: `Given these related memories under the topic "${clusterLabels[cIdx]}":\n\n${memoryTexts}\n\nProduce a JSON object with:\n- "summary": A concise 1-2 sentence summary of the key theme\n- "facts": An array of 3-8 atomic, standalone facts extracted from these memories\n\nOutput ONLY valid JSON.`,
        tier: 'fast',
        maxTokens: 1024,
      })

      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned)
      summary = parsed.summary || clusterLabels[cIdx]
      facts = Array.isArray(parsed.facts) ? parsed.facts : []
    } catch {
      summary = clusterLabels[cIdx]
      facts = members.slice(0, 5).map(m => memories[m.index].title)
    }

    clusters.push({
      label: clusterLabels[cIdx],
      summary,
      facts,
      memoryCount: members.length,
    })
    clusterIdx++
  }

  // Phase 5: Generate overview
  onProgress?.({ phase: 'overview', percent: 85, detail: 'Generating knowledge overview...' })

  let overview: string
  try {
    const clusterSummaries = clusters.map(c => `- ${c.label}: ${c.summary}`).join('\n')
    overview = await callLLM({
      system: 'You write concise knowledge overviews. Be direct and informative.',
      prompt: `Given these knowledge clusters:\n\n${clusterSummaries}\n\nWrite a brief 2-4 sentence overview that captures the breadth and key themes of this knowledge base.`,
      tier: 'fast',
      maxTokens: 512,
    })
  } catch {
    overview = `Knowledge base with ${clusters.length} topic clusters covering ${memories.length} memories.`
  }

  const totalFacts = clusters.reduce((sum, c) => sum + c.facts.length, 0)
  const durationMs = Date.now() - startTime

  const pack: KnowledgePack = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    overview,
    clusters,
    stats: {
      totalMemories: memories.length,
      totalFacts,
      compressionRatio: memories.length > 0 ? parseFloat((totalFacts / memories.length).toFixed(2)) : 0,
      durationMs,
    },
  }

  saveKnowledgePack(pack)

  onProgress?.({ phase: 'done', percent: 100, detail: 'Compression complete' })

  return pack
}

// --- Import from memorypack Markdown ---

export function parseKnowledgeBaseMd(filePath: string): KnowledgePack | null {
  if (!fs.existsSync(filePath)) return null

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  let overview = ''
  const clusters: KnowledgeCluster[] = []
  let currentCluster: KnowledgeCluster | null = null
  let inOverview = false
  let inFacts = false

  for (const line of lines) {
    if (line.startsWith('## Overview')) {
      inOverview = true
      inFacts = false
      continue
    }
    if (line.startsWith('## ') && !line.startsWith('## Overview')) {
      inOverview = false
      inFacts = false
      if (currentCluster) clusters.push(currentCluster)
      const label = line.replace('## ', '').trim()
      currentCluster = { label, summary: '', facts: [], memoryCount: 0 }
      continue
    }
    if (line.startsWith('### Facts') || line.startsWith('### Key Facts')) {
      inFacts = true
      continue
    }
    if (line.startsWith('### ')) {
      inFacts = false
      continue
    }

    if (inOverview && line.trim()) {
      overview += (overview ? ' ' : '') + line.trim()
    }

    if (currentCluster && !inFacts && !line.startsWith('#') && line.trim() && !line.startsWith('- ')) {
      currentCluster.summary += (currentCluster.summary ? ' ' : '') + line.trim()
    }

    if (inFacts && currentCluster && line.startsWith('- ')) {
      currentCluster.facts.push(line.slice(2).trim())
    }
  }

  if (currentCluster) clusters.push(currentCluster)

  if (clusters.length === 0 && !overview) return null

  const totalFacts = clusters.reduce((sum, c) => sum + c.facts.length, 0)

  return {
    id: 'import-' + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    overview,
    clusters,
    stats: {
      totalMemories: 0,
      totalFacts,
      compressionRatio: 0,
      durationMs: 0,
    },
  }
}
