import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { chunkAllFiles, fileHash, Chunk } from './chunker'
import { embedText, embedBatch, cosineSimilarity, getEmbeddingStatus } from './embeddings'

interface StoredChunk {
  text: string
  sourceFile: string
  heading: string
  domain: string
  fileHash: string
  startLine: number
  embedding: number[]  // serialized Float32Array
}

interface VectorIndex {
  version: number
  fileHashes: Record<string, string>  // relativePath -> MD5
  chunks: StoredChunk[]
}

const INDEX_VERSION = 1
let index: VectorIndex | null = null

function getIndexPath(): string {
  return path.join(app.getPath('userData'), 'vector-index.json')
}

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

export function loadVectorIndex(): VectorIndex | null {
  try {
    const data = fs.readFileSync(getIndexPath(), 'utf-8')
    index = JSON.parse(data)
    if (!index || index.version !== INDEX_VERSION) {
      console.log('Vector index version mismatch, will rebuild')
      index = null
      return null
    }
    console.log(`Vector index loaded: ${index.chunks.length} chunks from ${Object.keys(index.fileHashes).length} files`)
    return index
  } catch {
    return null
  }
}

function saveIndex() {
  if (!index) return
  try {
    fs.writeFileSync(getIndexPath(), JSON.stringify(index), 'utf-8')
  } catch (err) {
    console.error('Failed to save vector index:', err)
  }
}

export async function rebuildIndex(onProgress?: (info: { phase: string; current: number; total: number }) => void): Promise<{ added: number; removed: number; total: number }> {
  const status = getEmbeddingStatus()
  if (!status.ready) {
    throw new Error('Embedding model not ready')
  }

  const memoryDir = getMemoryDir()
  const { chunks: allChunks, fileHashes: currentHashes } = chunkAllFiles(memoryDir)
  const existingIndex = index || loadVectorIndex()

  // Determine which files changed
  const existingHashes = existingIndex?.fileHashes || {}
  const changedFiles = new Set<string>()
  const unchangedFiles = new Set<string>()

  for (const [file, hash] of Object.entries(currentHashes)) {
    if (existingHashes[file] === hash) {
      unchangedFiles.add(file)
    } else {
      changedFiles.add(file)
    }
  }
  // Files that were deleted
  for (const file of Object.keys(existingHashes)) {
    if (!(file in currentHashes)) {
      changedFiles.add(file)
    }
  }

  // Keep existing embeddings for unchanged files
  const keptChunks: StoredChunk[] = []
  if (existingIndex) {
    for (const chunk of existingIndex.chunks) {
      if (unchangedFiles.has(chunk.sourceFile)) {
        keptChunks.push(chunk)
      }
    }
  }

  // Embed new/changed chunks
  const newChunks = allChunks.filter(c => changedFiles.has(c.sourceFile))
  const newStored: StoredChunk[] = []

  if (newChunks.length > 0) {
    onProgress?.({ phase: 'embedding', current: 0, total: newChunks.length })
    const texts = newChunks.map(c => c.text)
    const embeddings = await embedBatch(texts)

    for (let i = 0; i < newChunks.length; i++) {
      const emb = embeddings[i]
      if (!emb) continue
      newStored.push({
        ...newChunks[i],
        embedding: Array.from(emb),
      })
      if ((i + 1) % 50 === 0 || i === newChunks.length - 1) {
        onProgress?.({ phase: 'embedding', current: i + 1, total: newChunks.length })
      }
    }
  }

  const removed = (existingIndex?.chunks.length || 0) - keptChunks.length
  index = {
    version: INDEX_VERSION,
    fileHashes: currentHashes,
    chunks: [...keptChunks, ...newStored],
  }
  saveIndex()

  const result = { added: newStored.length, removed, total: index.chunks.length }
  console.log(`Vector index refreshed: ${result.added} added, ${result.removed} removed, ${result.total} total chunks`)
  return result
}

export interface SearchResult {
  text: string
  sourceFile: string
  heading: string
  domain: string
  score: number
  startLine: number
}

export interface SearchOptions {
  topK?: number
  minScore?: number
  domainFilter?: string
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { topK = 20, minScore = 0.2, domainFilter } = options

  if (!index || index.chunks.length === 0) return []

  const queryEmbedding = await embedText(query)
  if (!queryEmbedding) return []

  let candidates = index.chunks
  if (domainFilter) {
    candidates = candidates.filter(c => c.domain === domainFilter || c.domain.startsWith(domainFilter + '/'))
  }

  const scored: SearchResult[] = []
  for (const chunk of candidates) {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding)
    if (score >= minScore) {
      scored.push({
        text: chunk.text,
        sourceFile: chunk.sourceFile,
        heading: chunk.heading,
        domain: chunk.domain,
        score,
        startLine: chunk.startLine,
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

export async function multiSearch(queries: string[], options: SearchOptions = {}): Promise<SearchResult[]> {
  const { topK = 50, minScore = 0.25 } = options
  const allResults = new Map<string, SearchResult>()

  for (const query of queries) {
    const results = await search(query, { topK: Math.ceil(topK / queries.length) + 10, minScore })
    for (const r of results) {
      const key = `${r.sourceFile}:${r.startLine}`
      const existing = allResults.get(key)
      if (!existing || r.score > existing.score) {
        allResults.set(key, r)
      }
    }
  }

  const merged = Array.from(allResults.values())
  merged.sort((a, b) => b.score - a.score)
  return merged.slice(0, topK)
}

export function getIndexStats(): { chunkCount: number; fileCount: number; sizeBytes: number } | null {
  if (!index) return null
  try {
    const stats = fs.statSync(getIndexPath())
    return {
      chunkCount: index.chunks.length,
      fileCount: Object.keys(index.fileHashes).length,
      sizeBytes: stats.size,
    }
  } catch {
    return {
      chunkCount: index.chunks.length,
      fileCount: Object.keys(index.fileHashes).length,
      sizeBytes: 0,
    }
  }
}

export function deleteIndex(): void {
  try {
    fs.unlinkSync(getIndexPath())
  } catch {}
  index = null
}
