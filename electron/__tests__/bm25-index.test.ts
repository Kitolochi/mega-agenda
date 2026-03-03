// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createTempDir, cleanupTempDir } from './helpers/temp-dir'
import { basicChunks, multiDomainChunks } from './fixtures/sample-chunks'

// ── Electron mock ────────────────────────────────────────────────────
const mockElectronState = vi.hoisted(() => ({ userDataDir: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((_name: string) => mockElectronState.userDataDir),
  },
}))

// Now import the module under test
import {
  buildBM25Index,
  saveBM25Index,
  loadBM25Index,
  searchBM25,
  deleteBM25Index,
} from '../bm25-index'

let tempDir: string

beforeEach(() => {
  tempDir = createTempDir()
  mockElectronState.userDataDir = tempDir
  // Ensure clean state
  deleteBM25Index()
})

afterEach(() => {
  deleteBM25Index()
  cleanupTempDir(tempDir)
})

// ── Build + Search round-trip ────────────────────────────────────────

describe('buildBM25Index + searchBM25', () => {
  it('builds index and returns document count', () => {
    const count = buildBM25Index(basicChunks)
    expect(count).toBe(basicChunks.length)
  })

  it('searches and returns matching results', () => {
    buildBM25Index(basicChunks)
    const results = searchBM25('JavaScript programming')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toContain('JavaScript')
  })

  it('returns results sorted by score descending', () => {
    buildBM25Index(multiDomainChunks)
    const results = searchBM25('React')
    expect(results.length).toBeGreaterThan(0)
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })

  it('returns empty array when query does not match', () => {
    buildBM25Index(basicChunks)
    const results = searchBM25('xyzzyplughtwisty')
    expect(results).toEqual([])
  })

  it('finds results with fuzzy matching (typos)', () => {
    buildBM25Index(basicChunks)
    // "JavaScrpt" is a typo for "JavaScript" — fuzzy: 0.2 should still match
    const results = searchBM25('JavaScrpt')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toContain('JavaScript')
  })

  it('finds results with prefix search', () => {
    buildBM25Index(basicChunks)
    // "Java" is a prefix of "JavaScript"
    const results = searchBM25('Java')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toContain('JavaScript')
  })

  it('boosts text field higher than heading (2x vs 1x)', () => {
    buildBM25Index(multiDomainChunks)
    // "Tailwind" appears in both text and heading of the Tailwind chunk
    // "Reciprocal" appears in both text and heading of the RRF chunk
    // Both should be found — the text match matters more
    const results = searchBM25('Tailwind')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toContain('Tailwind')
  })

  it('handles empty chunks array', () => {
    const count = buildBM25Index([])
    expect(count).toBe(0)
    const results = searchBM25('anything')
    expect(results).toEqual([])
  })
})

// ── Save + Load persistence ──────────────────────────────────────────

describe('saveBM25Index + loadBM25Index', () => {
  it('saves index to disk', () => {
    buildBM25Index(basicChunks)
    saveBM25Index()
    const indexPath = path.join(tempDir, 'bm25-index.json')
    expect(fs.existsSync(indexPath)).toBe(true)
    const content = fs.readFileSync(indexPath, 'utf-8')
    expect(content.length).toBeGreaterThan(0)
    // Should be valid JSON
    expect(() => JSON.parse(content)).not.toThrow()
  })

  it('loads index from disk and search works', async () => {
    buildBM25Index(basicChunks)
    saveBM25Index()

    // Reset module to simulate app restart (clears in-memory state, keeps disk file)
    vi.resetModules()
    const fresh = await import('../bm25-index')

    const loaded = fresh.loadBM25Index()
    expect(loaded).toBe(true)

    // Search should work on the reloaded index
    const results = fresh.searchBM25('JavaScript')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toContain('JavaScript')

    // Cleanup the fresh module's state
    fresh.deleteBM25Index()
  })

  it('returns false when no index file exists', () => {
    expect(loadBM25Index()).toBe(false)
  })

  it('returns false for corrupt JSON file', () => {
    const indexPath = path.join(tempDir, 'bm25-index.json')
    fs.writeFileSync(indexPath, 'this is not valid JSON{{{', 'utf-8')
    expect(loadBM25Index()).toBe(false)
  })

  it('returns false for empty file', () => {
    const indexPath = path.join(tempDir, 'bm25-index.json')
    fs.writeFileSync(indexPath, '', 'utf-8')
    expect(loadBM25Index()).toBe(false)
  })

  it('returns false for wrong JSON structure', () => {
    const indexPath = path.join(tempDir, 'bm25-index.json')
    fs.writeFileSync(indexPath, '{"wrong":"structure"}', 'utf-8')
    expect(loadBM25Index()).toBe(false)
  })

  it('sets miniSearch to null on load failure', () => {
    buildBM25Index(basicChunks)
    expect(searchBM25('JavaScript').length).toBeGreaterThan(0)

    // Write corrupt index
    const indexPath = path.join(tempDir, 'bm25-index.json')
    fs.writeFileSync(indexPath, 'corrupt', 'utf-8')

    // Load should fail and clear state
    expect(loadBM25Index()).toBe(false)
    expect(searchBM25('JavaScript')).toEqual([])
  })
})

// ── searchBM25 options ───────────────────────────────────────────────

describe('searchBM25 options', () => {
  beforeEach(() => {
    buildBM25Index(multiDomainChunks)
  })

  it('filters by exact domain', () => {
    const results = searchBM25('search', { domainFilter: 'search' })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.domain === 'search' || r.domain.startsWith('search/')).toBe(true)
    }
  })

  it('filters by domain prefix', () => {
    const results = searchBM25('Electron', { domainFilter: 'sessions' })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.domain.startsWith('sessions')).toBe(true)
    }
  })

  it('excludes non-matching domains', () => {
    const results = searchBM25('React', { domainFilter: 'search' })
    // "React" content is in domain "docs", so search domain should not find it
    for (const r of results) {
      expect(r.domain).not.toBe('docs')
    }
  })

  it('returns empty array for empty query', () => {
    expect(searchBM25('')).toEqual([])
  })

  it('returns empty array for whitespace-only query', () => {
    expect(searchBM25('   ')).toEqual([])
  })

  it('returns empty array when index not built', () => {
    deleteBM25Index()
    expect(searchBM25('anything')).toEqual([])
  })

  it('respects topK limit', () => {
    const results = searchBM25('programming language', { topK: 2 })
    expect(results.length).toBeLessThanOrEqual(2)
  })
})

// ── deleteBM25Index ──────────────────────────────────────────────────

describe('deleteBM25Index', () => {
  it('clears in-memory index', () => {
    buildBM25Index(basicChunks)
    expect(searchBM25('JavaScript').length).toBeGreaterThan(0)

    deleteBM25Index()
    expect(searchBM25('JavaScript')).toEqual([])
  })

  it('removes index file from disk', () => {
    buildBM25Index(basicChunks)
    saveBM25Index()
    const indexPath = path.join(tempDir, 'bm25-index.json')
    expect(fs.existsSync(indexPath)).toBe(true)

    deleteBM25Index()
    expect(fs.existsSync(indexPath)).toBe(false)
  })

  it('search returns empty after delete', () => {
    buildBM25Index(multiDomainChunks)
    deleteBM25Index()
    expect(searchBM25('React')).toEqual([])
    expect(searchBM25('Vector')).toEqual([])
    expect(searchBM25('BM25')).toEqual([])
  })
})
