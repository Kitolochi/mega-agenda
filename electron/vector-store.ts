import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { chunkAllFiles, Chunk } from './chunker'
import { embedText, embedBatch, getEmbeddingStatus } from './embeddings'
import * as lancedb from '@lancedb/lancedb'
import {
  Schema, Field, Utf8, Float32, Int32, FixedSizeList,
} from 'apache-arrow'

// ── Schema ──────────────────────────────────────────────────────────
const VECTOR_DIM = 384
const TABLE_NAME = 'chunks'

const chunkSchema = new Schema([
  new Field('text', new Utf8(), false),
  new Field('sourceFile', new Utf8(), false),
  new Field('heading', new Utf8(), false),
  new Field('domain', new Utf8(), false),
  new Field('fileHash', new Utf8(), false),
  new Field('startLine', new Int32(), false),
  new Field(
    'vector',
    new FixedSizeList(VECTOR_DIM, new Field('item', new Float32())),
    false,
  ),
])

// ── State ───────────────────────────────────────────────────────────
let db: lancedb.Connection | null = null
let table: lancedb.Table | null = null
// File hashes kept in a small sidecar JSON for fast diff without querying LanceDB
let fileHashes: Record<string, string> = {}

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'vector-db')
}

function getHashesPath(): string {
  return path.join(app.getPath('userData'), 'vector-db-hashes.json')
}

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

function loadHashes(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(getHashesPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveHashes() {
  try {
    fs.writeFileSync(getHashesPath(), JSON.stringify(fileHashes), 'utf-8')
  } catch (err) {
    console.error('Failed to save vector-db hashes:', err)
  }
}

// ── Public API (same signatures as before) ──────────────────────────

export async function loadVectorIndex(): Promise<{ chunkCount: number } | null> {
  try {
    const dbPath = getDbPath()
    db = await lancedb.connect(dbPath)
    const names = await db.tableNames()
    if (names.includes(TABLE_NAME)) {
      table = await db.openTable(TABLE_NAME)
      fileHashes = loadHashes()
      const count = await table.countRows()
      console.log(`Vector index loaded: ${count} chunks (LanceDB) from ${Object.keys(fileHashes).length} files`)
      return { chunkCount: count }
    }
    // Table doesn't exist yet — will be created on rebuildIndex
    console.log('Vector DB exists but no chunks table — will rebuild')
    return null
  } catch {
    // DB dir doesn't exist yet — first run
    return null
  }
}

export async function rebuildIndex(
  onProgress?: (info: { phase: string; current: number; total: number }) => void,
): Promise<{ added: number; removed: number; total: number }> {
  const status = getEmbeddingStatus()
  if (!status.ready) {
    throw new Error('Embedding model not ready')
  }

  // Ensure DB connection
  if (!db) {
    const dbPath = getDbPath()
    db = await lancedb.connect(dbPath)
  }

  const memoryDir = getMemoryDir()
  const { chunks: allChunks, fileHashes: currentHashes } = chunkAllFiles(memoryDir)
  const existingHashes = fileHashes

  // Determine which files changed
  const changedFiles = new Set<string>()
  const deletedFiles = new Set<string>()

  for (const [file, hash] of Object.entries(currentHashes)) {
    if (existingHashes[file] !== hash) {
      changedFiles.add(file)
    }
  }
  for (const file of Object.keys(existingHashes)) {
    if (!(file in currentHashes)) {
      deletedFiles.add(file)
      changedFiles.add(file) // count deletions as changes for stats
    }
  }

  // If nothing changed and table exists, shortcut
  if (changedFiles.size === 0 && table) {
    const total = await table.countRows()
    console.log(`Vector index up to date: ${total} chunks`)
    return { added: 0, removed: 0, total }
  }

  // Files that need their rows removed (changed or deleted)
  const filesToRemove = new Set([...changedFiles, ...deletedFiles])

  // Delete stale rows for changed/deleted files
  let removedCount = 0
  if (table && filesToRemove.size > 0) {
    const quoted = [...filesToRemove].map(f => `'${escapeSql(f)}'`).join(', ')
    const predicate = `sourceFile IN (${quoted})`
    removedCount = await table.countRows(predicate)
    await table.delete(predicate)
  }

  // Embed new/changed chunks (not deleted files)
  const newChunks = allChunks.filter(c => changedFiles.has(c.sourceFile))
  const rows: Record<string, unknown>[] = []

  if (newChunks.length > 0) {
    onProgress?.({ phase: 'embedding', current: 0, total: newChunks.length })
    const texts = newChunks.map(c => c.text)
    const embeddings = await embedBatch(texts)

    for (let i = 0; i < newChunks.length; i++) {
      const emb = embeddings[i]
      if (!emb) continue
      rows.push({
        text: newChunks[i].text,
        sourceFile: newChunks[i].sourceFile,
        heading: newChunks[i].heading,
        domain: newChunks[i].domain,
        fileHash: newChunks[i].fileHash,
        startLine: newChunks[i].startLine,
        vector: Array.from(emb),
      })
      if ((i + 1) % 50 === 0 || i === newChunks.length - 1) {
        onProgress?.({ phase: 'embedding', current: i + 1, total: newChunks.length })
      }
    }
  }

  // Create table or add rows
  if (!table) {
    // First build — create the table
    if (rows.length > 0) {
      table = await db.createTable(TABLE_NAME, rows, { schema: chunkSchema, mode: 'overwrite' })
    } else {
      table = await db.createEmptyTable(TABLE_NAME, chunkSchema)
    }
  } else if (rows.length > 0) {
    await table.add(rows)
  }

  // Persist file hashes
  fileHashes = currentHashes
  saveHashes()

  const total = await table.countRows()
  const result = { added: rows.length, removed: removedCount, total }
  console.log(`Vector index refreshed: ${result.added} added, ${result.removed} removed, ${result.total} total chunks`)
  return result
}

// ── Search ──────────────────────────────────────────────────────────

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

  if (!table) return []

  const queryEmbedding = await embedText(query)
  if (!queryEmbedding) return []

  let q = table
    .search(Array.from(queryEmbedding))
    .distanceType('cosine')
    .select(['text', 'sourceFile', 'heading', 'domain', 'startLine', '_distance'])
    .limit(topK * 2) // over-fetch to allow post-filtering by minScore

  if (domainFilter) {
    q = q.where(`domain = '${escapeSql(domainFilter)}' OR domain LIKE '${escapeSql(domainFilter)}/%'`)
  }

  const raw = await q.toArray()

  const results: SearchResult[] = []
  for (const row of raw) {
    // LanceDB cosine distance = 1 - cosine_similarity (0 = identical, 1 = orthogonal)
    const score = 1 - (row._distance ?? 1)
    if (score < minScore) continue
    results.push({
      text: row.text,
      sourceFile: row.sourceFile,
      heading: row.heading,
      domain: row.domain,
      score,
      startLine: row.startLine,
    })
  }

  return results.slice(0, topK)
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

// ── Stats & Cleanup ─────────────────────────────────────────────────

export async function getIndexStats(): Promise<{ chunkCount: number; fileCount: number; sizeBytes: number } | null> {
  if (!table) return null
  try {
    const chunkCount = await table.countRows()
    const fileCount = Object.keys(fileHashes).length
    // Approximate size from the LanceDB directory
    let sizeBytes = 0
    const dbPath = getDbPath()
    if (fs.existsSync(dbPath)) {
      sizeBytes = dirSize(dbPath)
    }
    return { chunkCount, fileCount, sizeBytes }
  } catch {
    return null
  }
}

export async function deleteIndex(): Promise<void> {
  try {
    // Drop the table if connection exists
    if (db) {
      const names = await db.tableNames()
      if (names.includes(TABLE_NAME)) {
        await db.dropTable(TABLE_NAME)
      }
    }
  } catch {}
  try {
    // Remove the entire DB directory
    const dbPath = getDbPath()
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true })
    }
    // Remove hashes sidecar
    const hashPath = getHashesPath()
    if (fs.existsSync(hashPath)) {
      fs.unlinkSync(hashPath)
    }
  } catch {}
  db = null
  table = null
  fileHashes = {}
}

// ── Helpers ─────────────────────────────────────────────────────────

function escapeSql(s: string): string {
  return s.replace(/'/g, "''")
}

function dirSize(dir: string): number {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += dirSize(p)
    } else {
      total += fs.statSync(p).size
    }
  }
  return total
}
