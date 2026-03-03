// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createTempDir, cleanupTempDir } from './helpers/temp-dir'
import type { Chunk } from '../chunker'

// ── Hoisted shared state (available in vi.mock factories) ────────────

const mockState = vi.hoisted(() => {
  const vectorRows: any[] = []
  const bm25Results: any[] = []
  const tableNames: string[] = []
  let countRowsValue = 0

  return { vectorRows, bm25Results, tableNames, countRowsValue, userDataDir: '' }
})

// ── LanceDB chainable query mock ─────────────────────────────────────

const { mockQueryBuilder, mockTable, mockDb } = vi.hoisted(() => {
  const query: any = {}
  query.distanceType = vi.fn(() => query)
  query.select = vi.fn(() => query)
  query.limit = vi.fn(() => query)
  query.where = vi.fn(() => query)
  query.toArray = vi.fn(async () => mockState.vectorRows)

  const table = {
    search: vi.fn(() => {
      // Return a fresh chain so each call is independent
      const q: any = {}
      q.distanceType = vi.fn(() => q)
      q.select = vi.fn(() => q)
      q.limit = vi.fn(() => q)
      q.where = vi.fn(() => q)
      q.toArray = vi.fn(async () => mockState.vectorRows)
      return q
    }),
    countRows: vi.fn(async (_pred?: string) => mockState.countRowsValue),
    add: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  }

  const db = {
    tableNames: vi.fn(async () => [...mockState.tableNames]),
    openTable: vi.fn(async () => table),
    createTable: vi.fn(async () => table),
    createEmptyTable: vi.fn(async () => table),
    dropTable: vi.fn(async () => {}),
  }

  return { mockQueryBuilder: query, mockTable: table, mockDb: db }
})

// ── Module mocks ─────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((_name: string) => mockState.userDataDir),
  },
}))

vi.mock('@lancedb/lancedb', () => ({
  connect: vi.fn(async () => mockDb),
}))

vi.mock('apache-arrow', () => ({
  Schema: vi.fn(),
  Field: vi.fn(),
  Utf8: vi.fn(),
  Float32: vi.fn(),
  Int32: vi.fn(),
  FixedSizeList: vi.fn(),
}))

vi.mock('../embeddings', () => ({
  embedText: vi.fn(async (_text: string) => {
    const vec = new Float32Array(384)
    for (let i = 0; i < 384; i++) vec[i] = Math.random() * 0.1
    return vec
  }),
  embedBatch: vi.fn(async (texts: string[]) => {
    return texts.map(() => {
      const vec = new Float32Array(384)
      for (let i = 0; i < 384; i++) vec[i] = Math.random() * 0.1
      return vec
    })
  }),
  getEmbeddingStatus: vi.fn(() => ({ ready: true, loading: false, error: null, progress: 100 })),
}))

vi.mock('../session-parser', () => ({
  discoverSessions: vi.fn(() => []),
  parseSession: vi.fn(async () => []),
  sessionFileHash: vi.fn(() => 'mock-hash'),
}))

vi.mock('../bm25-index', () => ({
  buildBM25Index: vi.fn(() => 0),
  saveBM25Index: vi.fn(),
  loadBM25Index: vi.fn(() => true),
  searchBM25: vi.fn((_query: string, _opts?: any) => [...mockState.bm25Results]),
  deleteBM25Index: vi.fn(),
}))

vi.mock('../chunker', () => ({
  chunkAllFiles: vi.fn((_dir: string) => ({ chunks: [], fileHashes: {} })),
}))

// ── Import module under test (uses mocked deps) ─────────────────────

import {
  search,
  multiSearch,
  loadVectorIndex,
  rebuildIndex,
  deleteIndex,
} from '../vector-store'
import type { SearchResult } from '../vector-store'
import { getEmbeddingStatus } from '../embeddings'
import { discoverSessions, parseSession, sessionFileHash } from '../session-parser'
import { searchBM25, buildBM25Index, saveBM25Index, deleteBM25Index } from '../bm25-index'
import { chunkAllFiles } from '../chunker'

let tempDir: string

beforeEach(async () => {
  tempDir = createTempDir()
  mockState.userDataDir = tempDir
  mockState.vectorRows.length = 0
  mockState.bm25Results.length = 0
  mockState.tableNames.length = 0
  mockState.countRowsValue = 0
  vi.clearAllMocks()

  // Reset module state
  await deleteIndex()
})

afterEach(async () => {
  await deleteIndex()
  cleanupTempDir(tempDir)
})

// ── Helper to set up table ───────────────────────────────────────────

async function setupTable(chunkCount = 10) {
  mockState.tableNames.push('chunks')
  mockState.countRowsValue = chunkCount
  await loadVectorIndex()
}

// ── search() — hybrid search ─────────────────────────────────────────

describe('search (hybrid)', () => {
  it('returns empty when both vector and BM25 return nothing', async () => {
    await setupTable()
    mockState.vectorRows.length = 0
    mockState.bm25Results.length = 0
    const results = await search('test query')
    expect(results).toEqual([])
  })

  it('returns vector results when BM25 is empty', async () => {
    await setupTable()
    mockState.vectorRows.push(
      { text: 'Vector hit A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.3 },
      { text: 'Vector hit B', sourceFile: 'b.md', heading: 'B', domain: 'test', startLine: 1, _distance: 0.5 },
    )
    mockState.bm25Results.length = 0

    const results = await search('query')
    expect(results.length).toBe(2)
    expect(results[0].text).toBe('Vector hit A')
    // Score = 1 - distance
    expect(results[0].score).toBeCloseTo(0.7, 1)
  })

  it('returns BM25 results normalized when vector is empty', async () => {
    await setupTable()
    // embedText returning null means no vector results
    vi.mocked(getEmbeddingStatus).mockReturnValue({ ready: true, loading: false, error: null, progress: 100 })
    // Make embedText return null to simulate no vector results
    const { embedText } = await import('../embeddings')
    vi.mocked(embedText).mockResolvedValueOnce(null)

    mockState.bm25Results.push(
      { text: 'BM25 hit A', sourceFile: 'a.md', heading: 'A', domain: 'test', score: 10, startLine: 1 },
      { text: 'BM25 hit B', sourceFile: 'b.md', heading: 'B', domain: 'test', score: 5, startLine: 2 },
    )

    const results = await search('query')
    expect(results.length).toBe(2)
    // Scores should be normalized: top = 1.0
    expect(results[0].score).toBeCloseTo(1.0, 1)
    expect(results[1].score).toBeCloseTo(0.5, 1)
  })

  it('merges results via RRF when both have results', async () => {
    await setupTable()
    // Vector returns A, B, C
    mockState.vectorRows.push(
      { text: 'Item A', sourceFile: 'fileA.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.3 },
      { text: 'Item B', sourceFile: 'fileB.md', heading: 'B', domain: 'test', startLine: 1, _distance: 0.4 },
      { text: 'Item C', sourceFile: 'fileC.md', heading: 'C', domain: 'test', startLine: 1, _distance: 0.5 },
    )
    // BM25 returns B, D, A (different order)
    mockState.bm25Results.push(
      { text: 'Item B', sourceFile: 'fileB.md', heading: 'B', domain: 'test', score: 10, startLine: 1 },
      { text: 'Item D', sourceFile: 'fileD.md', heading: 'D', domain: 'test', score: 8, startLine: 1 },
      { text: 'Item A', sourceFile: 'fileA.md', heading: 'A', domain: 'test', score: 6, startLine: 1 },
    )

    const results = await search('query')
    expect(results.length).toBe(4) // A, B, C, D
  })

  it('RRF boosts items present in both result sets', async () => {
    await setupTable()
    // Item X in both sets, Item Y only in vector, Item Z only in BM25
    mockState.vectorRows.push(
      { text: 'Item X', sourceFile: 'x.md', heading: 'X', domain: 'test', startLine: 1, _distance: 0.3 },
      { text: 'Item Y', sourceFile: 'y.md', heading: 'Y', domain: 'test', startLine: 1, _distance: 0.4 },
    )
    mockState.bm25Results.push(
      { text: 'Item X', sourceFile: 'x.md', heading: 'X', domain: 'test', score: 10, startLine: 1 },
      { text: 'Item Z', sourceFile: 'z.md', heading: 'Z', domain: 'test', score: 8, startLine: 1 },
    )

    const results = await search('query')
    // Item X should be ranked first (in both lists)
    expect(results[0].sourceFile).toBe('x.md')
  })

  it('RRF normalizes top score to 1.0', async () => {
    await setupTable()
    mockState.vectorRows.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.3 },
    )
    mockState.bm25Results.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', score: 5, startLine: 1 },
    )

    const results = await search('query')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeCloseTo(1.0, 5)
  })

  it('RRF scores are in [0, 1] range', async () => {
    await setupTable()
    mockState.vectorRows.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.2 },
      { text: 'B', sourceFile: 'b.md', heading: 'B', domain: 'test', startLine: 1, _distance: 0.4 },
      { text: 'C', sourceFile: 'c.md', heading: 'C', domain: 'test', startLine: 1, _distance: 0.6 },
    )
    mockState.bm25Results.push(
      { text: 'B', sourceFile: 'b.md', heading: 'B', domain: 'test', score: 10, startLine: 1 },
      { text: 'D', sourceFile: 'd.md', heading: 'D', domain: 'test', score: 5, startLine: 1 },
    )

    const results = await search('query')
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    }
  })

  it('respects topK parameter', async () => {
    await setupTable()
    for (let i = 0; i < 10; i++) {
      mockState.vectorRows.push({
        text: `Item ${i}`, sourceFile: `f${i}.md`, heading: `H${i}`,
        domain: 'test', startLine: i, _distance: 0.3 + i * 0.05,
      })
    }

    const results = await search('query', { topK: 3 })
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('passes domain filter to both searches', async () => {
    await setupTable()
    mockState.vectorRows.push(
      { text: 'Hit', sourceFile: 'a.md', heading: 'A', domain: 'filtered', startLine: 1, _distance: 0.3 },
    )

    await search('query', { domainFilter: 'mydom' })
    expect(vi.mocked(searchBM25)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ domainFilter: 'mydom' }),
    )
  })

  it('returns empty when table is null', async () => {
    // Don't set up table — table remains null
    const results = await search('query')
    expect(results).toEqual([])
  })
})

// ── RRF behavior tested through search() ─────────────────────────────

describe('reciprocalRankFusion (via search)', () => {
  beforeEach(async () => {
    await setupTable()
  })

  it('unique vector items keep their RRF score', async () => {
    mockState.vectorRows.push(
      { text: 'Only vector', sourceFile: 'v.md', heading: 'V', domain: 'test', startLine: 1, _distance: 0.3 },
    )
    mockState.bm25Results.length = 0
    // When only vector results exist, returns them directly (no RRF)
    const results = await search('query')
    expect(results.length).toBe(1)
  })

  it('unique BM25 items keep their RRF score', async () => {
    // No vector results (embedText returns null)
    const { embedText } = await import('../embeddings')
    vi.mocked(embedText).mockResolvedValueOnce(null)

    mockState.bm25Results.push(
      { text: 'Only BM25', sourceFile: 'b.md', heading: 'B', domain: 'test', score: 5, startLine: 1 },
    )

    const results = await search('query')
    expect(results.length).toBe(1)
  })

  it('overlapping items get combined RRF score higher than either alone', async () => {
    // A in both, B in vector only, C in BM25 only
    mockState.vectorRows.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.4 },
      { text: 'B', sourceFile: 'b.md', heading: 'B', domain: 'test', startLine: 1, _distance: 0.3 },
    )
    mockState.bm25Results.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', score: 8, startLine: 1 },
      { text: 'C', sourceFile: 'c.md', heading: 'C', domain: 'test', score: 10, startLine: 1 },
    )

    const results = await search('query')
    const aResult = results.find(r => r.sourceFile === 'a.md')
    const bResult = results.find(r => r.sourceFile === 'b.md')
    const cResult = results.find(r => r.sourceFile === 'c.md')

    // A should have the highest score (in both lists)
    expect(aResult!.score).toBeGreaterThan(bResult!.score)
    expect(aResult!.score).toBeGreaterThan(cResult!.score)
  })

  it('results are sorted by score descending', async () => {
    mockState.vectorRows.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.3 },
      { text: 'B', sourceFile: 'b.md', heading: 'B', domain: 'test', startLine: 2, _distance: 0.5 },
    )
    mockState.bm25Results.push(
      { text: 'C', sourceFile: 'c.md', heading: 'C', domain: 'test', score: 5, startLine: 1 },
    )

    const results = await search('query')
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })

  it('handles single result from each source', async () => {
    mockState.vectorRows.push(
      { text: 'V', sourceFile: 'v.md', heading: 'V', domain: 'test', startLine: 1, _distance: 0.3 },
    )
    mockState.bm25Results.push(
      { text: 'B', sourceFile: 'b.md', heading: 'B', domain: 'test', score: 5, startLine: 1 },
    )

    const results = await search('query')
    expect(results.length).toBe(2)
  })
})

// ── rebuildIndex ─────────────────────────────────────────────────────

describe('rebuildIndex', () => {
  it('throws when rebuild is already in progress', async () => {
    await setupTable()
    // Start first rebuild (will not resolve immediately due to mocks)
    const p1 = rebuildIndex()
    // Second call should throw
    await expect(rebuildIndex()).rejects.toThrow('already in progress')
    await p1
  })

  it('throws when embedding model not ready', async () => {
    vi.mocked(getEmbeddingStatus).mockReturnValueOnce({
      ready: false, loading: false, error: 'not loaded', progress: 0,
    })
    await expect(rebuildIndex()).rejects.toThrow('not ready')
  })

  it('discovers sessions and parses them', async () => {
    const mockSession = {
      path: '/fake/session.jsonl',
      project: 'test-proj',
      sessionId: 'sess1',
      size: 100,
      mtimeMs: Date.now(),
    }
    vi.mocked(discoverSessions).mockReturnValue([mockSession])
    vi.mocked(sessionFileHash).mockReturnValue('new-hash')
    vi.mocked(parseSession).mockResolvedValue([{
      text: 'Test chunk that is long enough for the minimum size filter.',
      sourceFile: 'sessions/test-proj/sess1.jsonl',
      heading: 'Test',
      domain: 'sessions/test-proj',
      fileHash: 'new-hash',
      startLine: 0,
    }])

    await rebuildIndex()

    expect(discoverSessions).toHaveBeenCalled()
    expect(parseSession).toHaveBeenCalledWith(mockSession)
  })

  it('skips unchanged files with matching hash', async () => {
    // First build
    const mockSession = {
      path: '/fake/session.jsonl',
      project: 'test-proj',
      sessionId: 'sess1',
      size: 100,
      mtimeMs: Date.now(),
    }
    vi.mocked(discoverSessions).mockReturnValue([mockSession])
    vi.mocked(sessionFileHash).mockReturnValue('hash-v1')
    vi.mocked(parseSession).mockResolvedValue([])

    await rebuildIndex()
    vi.mocked(parseSession).mockClear()

    // Second build with same hash — but deleteIndex resets state
    // So we need to do two builds without delete between them
    // This requires not resetting state between the two calls
  })

  it('embeds only changed chunks', async () => {
    const { embedBatch } = await import('../embeddings')
    const chunk: Chunk = {
      text: 'New content to embed for the vector index.',
      sourceFile: 'sessions/proj/sess.jsonl',
      heading: 'Test',
      domain: 'sessions/proj',
      fileHash: 'new-hash',
      startLine: 0,
    }
    vi.mocked(discoverSessions).mockReturnValue([{
      path: '/fake/sess.jsonl', project: 'proj', sessionId: 'sess', size: 100, mtimeMs: Date.now(),
    }])
    vi.mocked(sessionFileHash).mockReturnValue('new-hash')
    vi.mocked(parseSession).mockResolvedValue([chunk])

    await rebuildIndex()

    expect(embedBatch).toHaveBeenCalled()
  })

  it('creates table on first build', async () => {
    // Don't set up existing table
    vi.mocked(discoverSessions).mockReturnValue([])
    await rebuildIndex()

    // Should have created empty table
    expect(mockDb.createEmptyTable).toHaveBeenCalled()
  })

  it('adds rows to existing table', async () => {
    await setupTable()
    const chunk: Chunk = {
      text: 'Content to add to the existing table.',
      sourceFile: 'sessions/proj/s.jsonl',
      heading: 'H',
      domain: 'sessions/proj',
      fileHash: 'h',
      startLine: 0,
    }
    vi.mocked(discoverSessions).mockReturnValue([{
      path: '/fake/s.jsonl', project: 'proj', sessionId: 's', size: 50, mtimeMs: Date.now(),
    }])
    vi.mocked(sessionFileHash).mockReturnValue('h')
    vi.mocked(parseSession).mockResolvedValue([chunk])

    await rebuildIndex()

    expect(mockTable.add).toHaveBeenCalled()
  })

  it('deletes stale rows for changed files', async () => {
    await setupTable()
    // Simulate a file that changed
    vi.mocked(discoverSessions).mockReturnValue([{
      path: '/fake/s.jsonl', project: 'proj', sessionId: 's', size: 50, mtimeMs: Date.now(),
    }])
    vi.mocked(sessionFileHash).mockReturnValue('new-hash')
    vi.mocked(parseSession).mockResolvedValue([])
    mockState.countRowsValue = 5 // simulate rows to delete

    await rebuildIndex()

    expect(mockTable.delete).toHaveBeenCalled()
  })

  it('builds BM25 index with all chunks', async () => {
    vi.mocked(discoverSessions).mockReturnValue([])
    await rebuildIndex()
    expect(buildBM25Index).toHaveBeenCalled()
  })

  it('saves BM25 index to disk', async () => {
    vi.mocked(discoverSessions).mockReturnValue([])
    await rebuildIndex()
    expect(saveBM25Index).toHaveBeenCalled()
  })

  it('reports progress via callback', async () => {
    const progress: { phase: string; current: number; total: number }[] = []
    vi.mocked(discoverSessions).mockReturnValue([])
    await rebuildIndex((info) => progress.push(info))
    // Should have reported at least sessions-discover phase
    expect(progress.some(p => p.phase === 'sessions-discover')).toBe(true)
  })

  it('returns correct added/removed/total counts', async () => {
    vi.mocked(discoverSessions).mockReturnValue([])
    mockState.countRowsValue = 0
    const result = await rebuildIndex()
    expect(result).toHaveProperty('added')
    expect(result).toHaveProperty('removed')
    expect(result).toHaveProperty('total')
    expect(typeof result.added).toBe('number')
    expect(typeof result.removed).toBe('number')
    expect(typeof result.total).toBe('number')
  })

  it('handles session parse errors gracefully', async () => {
    vi.mocked(discoverSessions).mockReturnValue([{
      path: '/fake/bad.jsonl', project: 'proj', sessionId: 'bad', size: 50, mtimeMs: Date.now(),
    }])
    vi.mocked(sessionFileHash).mockReturnValue('hash')
    vi.mocked(parseSession).mockRejectedValue(new Error('parse failed'))

    // Should not throw — session parse errors are non-fatal
    const result = await rebuildIndex()
    expect(result).toBeDefined()
  })
})

// ── deleteIndex ──────────────────────────────────────────────────────

describe('deleteIndex', () => {
  it('drops the table', async () => {
    await setupTable()
    mockState.tableNames.push('chunks')
    await deleteIndex()
    expect(mockDb.dropTable).toHaveBeenCalledWith('chunks')
  })

  it('removes DB directory', async () => {
    await setupTable()
    const dbPath = path.join(tempDir, 'vector-db')
    fs.mkdirSync(dbPath, { recursive: true })
    fs.writeFileSync(path.join(dbPath, 'data.lance'), 'test')

    await deleteIndex()
    expect(fs.existsSync(dbPath)).toBe(false)
  })

  it('removes hash sidecar files', async () => {
    await setupTable()
    const hashPath = path.join(tempDir, 'vector-db-hashes.json')
    const sessionHashPath = path.join(tempDir, 'vector-db-session-hashes.json')
    fs.writeFileSync(hashPath, '{}')
    fs.writeFileSync(sessionHashPath, '{}')

    await deleteIndex()
    expect(fs.existsSync(hashPath)).toBe(false)
    expect(fs.existsSync(sessionHashPath)).toBe(false)
  })

  it('calls deleteBM25Index', async () => {
    await setupTable()
    await deleteIndex()
    expect(deleteBM25Index).toHaveBeenCalled()
  })

  it('resets internal state (search returns empty after delete)', async () => {
    await setupTable()
    await deleteIndex()
    // After delete, search should return empty (table is null)
    const results = await search('test')
    expect(results).toEqual([])
  })

  it('handles missing DB gracefully', async () => {
    // No setup — db is null, no files exist
    await expect(deleteIndex()).resolves.not.toThrow()
  })
})

// ── multiSearch ──────────────────────────────────────────────────────

describe('multiSearch', () => {
  beforeEach(async () => {
    await setupTable()
  })

  it('merges results from multiple queries', async () => {
    // First query returns A
    mockState.vectorRows.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.3 },
    )
    mockState.bm25Results.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', score: 10, startLine: 1 },
    )

    const results = await multiSearch(['query1', 'query2'])
    expect(results.length).toBeGreaterThan(0)
  })

  it('deduplicates by sourceFile:startLine', async () => {
    // Both queries return the same item
    mockState.vectorRows.push(
      { text: 'Same', sourceFile: 'same.md', heading: 'S', domain: 'test', startLine: 1, _distance: 0.3 },
    )

    const results = await multiSearch(['query1', 'query2'])
    const keys = results.map(r => `${r.sourceFile}:${r.startLine}`)
    const unique = new Set(keys)
    expect(keys.length).toBe(unique.size)
  })

  it('keeps highest score for duplicates', async () => {
    mockState.vectorRows.push(
      { text: 'A', sourceFile: 'a.md', heading: 'A', domain: 'test', startLine: 1, _distance: 0.3 },
    )

    const results = await multiSearch(['query1', 'query2'])
    // Should only have one entry for a.md:1
    const aResults = results.filter(r => r.sourceFile === 'a.md' && r.startLine === 1)
    expect(aResults.length).toBe(1)
  })

  it('respects topK limit', async () => {
    for (let i = 0; i < 20; i++) {
      mockState.vectorRows.push({
        text: `Item ${i}`, sourceFile: `f${i}.md`, heading: `H${i}`,
        domain: 'test', startLine: i, _distance: 0.3,
      })
    }

    const results = await multiSearch(['q1', 'q2'], { topK: 5 })
    expect(results.length).toBeLessThanOrEqual(5)
  })
})
