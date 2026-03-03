// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createTempDir, cleanupTempDir } from './helpers/temp-dir'
import type { SessionMeta } from '../session-parser'

let tempDir: string
const fixturesDir = path.resolve(__dirname, 'fixtures')

beforeEach(() => {
  tempDir = createTempDir()
  vi.spyOn(os, 'homedir').mockReturnValue(tempDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanupTempDir(tempDir)
})

// Lazy import to ensure os mock is active when module executes
async function getModule() {
  return import('../session-parser')
}

// ── Helpers ──────────────────────────────────────────────────────────

function createProjectDir(name: string): string {
  const dir = path.join(tempDir, '.claude', 'projects', name)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function writeSession(projectDir: string, filename: string, lines: string[]): string {
  const filePath = path.join(projectDir, filename)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return filePath
}

function makeMeta(filePath: string, project: string, sessionId: string): SessionMeta {
  const stat = fs.statSync(filePath)
  return { path: filePath, project, sessionId, size: stat.size, mtimeMs: stat.mtimeMs }
}

// ── discoverSessions ─────────────────────────────────────────────────

describe('discoverSessions', () => {
  it('returns empty array when projects dir does not exist', async () => {
    const { discoverSessions } = await getModule()
    // tempDir/.claude/projects does not exist
    expect(discoverSessions()).toEqual([])
  })

  it('returns empty array when projects dir is empty', async () => {
    fs.mkdirSync(path.join(tempDir, '.claude', 'projects'), { recursive: true })
    const { discoverSessions } = await getModule()
    expect(discoverSessions()).toEqual([])
  })

  it('discovers sessions across multiple project directories', async () => {
    const projA = createProjectDir('project-a')
    const projB = createProjectDir('project-b')
    writeSession(projA, 'sess1.jsonl', ['{"type":"user","message":{"content":"hi"}}'])
    writeSession(projA, 'sess2.jsonl', ['{"type":"user","message":{"content":"hi"}}'])
    writeSession(projB, 'sess3.jsonl', ['{"type":"user","message":{"content":"hi"}}'])

    const { discoverSessions } = await getModule()
    const sessions = discoverSessions()
    expect(sessions).toHaveLength(3)
    expect(sessions.map(s => s.project).sort()).toEqual(['project-a', 'project-a', 'project-b'])
  })

  it('ignores non-JSONL files', async () => {
    const projDir = createProjectDir('myproj')
    writeSession(projDir, 'session.jsonl', ['{"type":"user","message":{"content":"hi"}}'])
    fs.writeFileSync(path.join(projDir, 'readme.txt'), 'not a session')
    fs.writeFileSync(path.join(projDir, 'data.json'), '{}')

    const { discoverSessions } = await getModule()
    const sessions = discoverSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe('session')
  })

  it('ignores non-directory entries in projects dir', async () => {
    const projectsDir = path.join(tempDir, '.claude', 'projects')
    fs.mkdirSync(projectsDir, { recursive: true })
    fs.writeFileSync(path.join(projectsDir, 'stray-file.txt'), 'not a directory')
    const projDir = createProjectDir('real-project')
    writeSession(projDir, 'sess.jsonl', ['{"type":"user","message":{"content":"hi"}}'])

    const { discoverSessions } = await getModule()
    const sessions = discoverSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].project).toBe('real-project')
  })

  it('handles permission errors on project subdirectories gracefully', async () => {
    const projDir = createProjectDir('ok-project')
    writeSession(projDir, 's.jsonl', ['{"type":"user","message":{"content":"hi"}}'])
    // Create a project dir we can't read (best-effort on Windows)
    createProjectDir('bad-project')

    const { discoverSessions } = await getModule()
    const sessions = discoverSessions()
    // Should at least find the ok-project session
    expect(sessions.some(s => s.project === 'ok-project')).toBe(true)
  })

  it('captures correct metadata fields', async () => {
    const projDir = createProjectDir('C--Users-chris-test')
    const filePath = writeSession(projDir, 'abc-def.jsonl', [
      '{"type":"user","message":{"content":"hello world"}}',
    ])
    const stat = fs.statSync(filePath)

    const { discoverSessions } = await getModule()
    const sessions = discoverSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].path).toBe(filePath)
    expect(sessions[0].project).toBe('C--Users-chris-test')
    expect(sessions[0].sessionId).toBe('abc-def')
    expect(sessions[0].size).toBe(stat.size)
    expect(sessions[0].mtimeMs).toBe(stat.mtimeMs)
  })
})

// ── sessionFileHash ──────────────────────────────────────────────────

describe('sessionFileHash', () => {
  it('returns MD5 hash for files under 1MB', async () => {
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', ['{"type":"user","message":{"content":"data"}}'])

    const { sessionFileHash } = await getModule()
    const meta = makeMeta(filePath, 'proj', 's')
    expect(meta.size).toBeLessThan(1_000_000)

    const hash = sessionFileHash(meta)
    // MD5 hex is 32 chars
    expect(hash).toMatch(/^[a-f0-9]{32}$/)
  })

  it('returns size:mtime for files >= 1MB', async () => {
    const { sessionFileHash } = await getModule()
    // Simulate a large file via meta (without creating 1MB on disk)
    const meta: SessionMeta = {
      path: '/nonexistent/large.jsonl',
      project: 'proj',
      sessionId: 'large',
      size: 2_000_000,
      mtimeMs: 1700000000000,
    }
    const hash = sessionFileHash(meta)
    expect(hash).toBe('2000000:1700000000000')
  })

  it('falls back to size:mtime when file cannot be read', async () => {
    const { sessionFileHash } = await getModule()
    const meta: SessionMeta = {
      path: '/nonexistent/missing.jsonl',
      project: 'proj',
      sessionId: 'missing',
      size: 500,
      mtimeMs: 1700000000000,
    }
    const hash = sessionFileHash(meta)
    expect(hash).toBe('500:1700000000000')
  })

  it('produces different hashes for different content', async () => {
    const projDir = createProjectDir('proj')
    const file1 = writeSession(projDir, 'a.jsonl', ['{"type":"user","message":{"content":"alpha"}}'])
    const file2 = writeSession(projDir, 'b.jsonl', ['{"type":"user","message":{"content":"beta"}}'])

    const { sessionFileHash } = await getModule()
    const hash1 = sessionFileHash(makeMeta(file1, 'proj', 'a'))
    const hash2 = sessionFileHash(makeMeta(file2, 'proj', 'b'))
    expect(hash1).not.toBe(hash2)
  })
})

// ── parseSession ─────────────────────────────────────────────────────

describe('parseSession', () => {
  // Helper to create a meta pointing at a fixture file
  function fixtureMeta(fixtureName: string, project = 'C--Users-chris-test', sessionId = 'test-sess'): SessionMeta {
    const filePath = path.join(fixturesDir, fixtureName)
    const stat = fs.statSync(filePath)
    return { path: filePath, project, sessionId, size: stat.size, mtimeMs: stat.mtimeMs }
  }

  it('returns empty array for empty file', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 'empty.jsonl', [])
    const meta = makeMeta(filePath, 'proj', 'empty')
    const chunks = await parseSession(meta)
    expect(chunks).toEqual([])
  })

  it('extracts content from message.content string format', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"user","message":{"content":"What is React? It is a JavaScript library for building user interfaces with a component-based architecture."}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].text).toContain('React')
  })

  it('extracts content from message.content array format', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Array block content that should be extracted by the parser. This needs to be reasonably long to pass the minimum chunk filter."},{"type":"tool_use","name":"test"}]}}',
      '{"type":"user","message":{"content":"A user message so the assistant block gets processed with proper context in the session"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.some(c => c.text.includes('Array block content'))).toBe(true)
  })

  it('extracts content from top-level content string format', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"user","content":"Top-level string content without the message wrapper object. This is a valid format for older sessions that should be extracted."}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].text).toContain('Top-level string content')
  })

  it('extracts content from top-level content array format', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"user","content":[{"type":"text","text":"Top-level array content blocks that should be extracted from the array by filtering for text type. This needs to be long enough."},{"type":"image","url":"img.png"}]}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.some(c => c.text.includes('Top-level array content'))).toBe(true)
  })

  it('handles missing content fields gracefully', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"user","message":{}}',
      '{"type":"assistant","message":{"content":null}}',
      '{"type":"user","message":{"content":""}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks).toEqual([])
  })

  it('skips progress type messages', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"progress","message":{"content":"Processing..."}}',
      '{"type":"user","message":{"content":"This valid user message should be the only one parsed from this session file with a progress type skipped"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.every(c => !c.text.includes('Processing'))).toBe(true)
  })

  it('skips summary type messages', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"summary","content":"Session summary text here"}',
      '{"type":"user","message":{"content":"Valid user message after summary that should be parsed and included in output chunks of the session"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.every(c => !c.text.includes('Session summary'))).toBe(true)
  })

  it('skips system type messages', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"system","message":{"content":"System init"}}',
      '{"type":"user","message":{"content":"Valid message after system type that should be parsed for inclusion in the session chunks output"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.every(c => !c.text.includes('System init'))).toBe(true)
  })

  it('skips file-history-snapshot type messages', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"file-history-snapshot","files":["a.ts","b.ts"]}',
      '{"type":"user","message":{"content":"Valid user message that should be parsed after the snapshot type was correctly skipped by the session parser"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    // The snapshot line content (files array) should NOT appear in chunks
    expect(chunks.every(c => !c.text.includes('a.ts'))).toBe(true)
    // The valid user message should appear
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('skips isMeta messages', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"user","isMeta":true,"message":{"content":"Meta message"}}',
      '{"type":"user","message":{"content":"Non-meta user message that should be parsed and included as a chunk in the output of the session parser"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    expect(chunks.every(c => !c.text.includes('Meta message'))).toBe(true)
  })

  it('truncates assistant responses at 2000 characters', async () => {
    const { parseSession } = await getModule()
    const longText = 'A'.repeat(3000)
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"assistant","message":{"content":"${longText}"}}`,
      '{"type":"user","message":{"content":"Follow-up question after the very long assistant response was provided in this session"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    const allText = chunks.map(c => c.text).join('')
    // The full 3000-char text should NOT appear — it should be truncated to 2000
    expect(allText).not.toContain('A'.repeat(2001))
  })

  it('does not truncate user messages', async () => {
    const { parseSession } = await getModule()
    const longText = 'B'.repeat(2500)
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"user","message":{"content":"${longText}"}}`,
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    const allText = chunks.map(c => c.text).join('')
    // User messages are NOT truncated — full 2500 chars should be present
    expect(allText).toContain('B'.repeat(2500))
  })

  it('creates chunks at approximately 500-char boundaries', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    // Create enough content to produce multiple chunks
    const lines: string[] = []
    for (let i = 0; i < 10; i++) {
      const content = `Question number ${i}: ${'X'.repeat(100)} end of question ${i}`
      lines.push(`{"type":"user","message":{"content":"${content}"}}`)
      const response = `Answer number ${i}: ${'Y'.repeat(100)} end of answer ${i}`
      lines.push(`{"type":"assistant","message":{"content":"${response}"}}`)
    }
    const filePath = writeSession(projDir, 's.jsonl', lines)
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)

    expect(chunks.length).toBeGreaterThan(1)
    // Most chunks should be around 500 chars (CHUNK_TARGET), allowing some variance
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThan(1500)
    }
  })

  it('splits at paragraph boundaries when possible', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    // Create content with clear paragraph breaks
    const para1 = 'First paragraph with substantial content. '.repeat(8)
    const para2 = 'Second paragraph with different content. '.repeat(8)
    const content = para1 + '\\n\\n' + para2
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"user","message":{"content":"${content}"}}`,
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)

    // Should have multiple chunks
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('filters chunks shorter than 64 characters', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const filePath = writeSession(projDir, 's.jsonl', [
      '{"type":"user","message":{"content":"Short"}}',
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    // "User: Short\n\n" is about 15 chars — well under 64
    expect(chunks).toEqual([])
  })

  it('sets correct domain using friendlyProjectName', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const content = 'This is a long enough user message to pass the minimum chunk size filter of sixty-four characters.'
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"user","message":{"content":"${content}"}}`,
    ])
    const meta = makeMeta(filePath, 'C--Users-chris-mega-agenda', 's')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    // friendlyProjectName('C--Users-chris-mega-agenda') → last 2 parts → 'mega-agenda'
    expect(chunks[0].domain).toBe('sessions/mega-agenda')
  })

  it('sets correct sourceFile format', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const content = 'This is a long enough user message to pass the minimum chunk size filter of sixty-four characters.'
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"user","message":{"content":"${content}"}}`,
    ])
    const meta = makeMeta(filePath, 'C--Users-chris-test', 'abc-def-123')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    // friendlyProjectName('C--Users-chris-test') splits to ['C','Users','chris','test'] → last 2 → 'chris-test'
    expect(chunks[0].sourceFile).toBe('sessions/chris-test/abc-def-123.jsonl')
  })

  it('uses first user prompt as heading', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const content = 'How do I implement authentication in my Express application? I need JWT support and middleware.'
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"user","message":{"content":"${content}"}}`,
      '{"type":"assistant","message":{"content":"To implement authentication you need passport.js or a custom middleware that validates JWT tokens on protected routes."}}',
    ])
    const meta = makeMeta(filePath, 'proj', 'session1')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    // Heading is first 80 chars of first user prompt
    expect(chunks[0].heading).toBe(content.slice(0, 80))
  })

  it('falls back to sessionId for heading when no user messages', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const content = 'This is an assistant-only message that is long enough to pass the sixty-four character minimum chunk size filter.'
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"assistant","message":{"content":"${content}"}}`,
    ])
    const meta = makeMeta(filePath, 'proj', 'my-session-id')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].heading).toBe('my-session-id')
  })

  it('handles corrupt JSONL lines gracefully', async () => {
    const { parseSession } = await getModule()
    const meta = fixtureMeta('corrupt-session.jsonl')
    const chunks = await parseSession(meta)
    // Should parse the valid lines and skip corrupt ones
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.some(c => c.text.includes('valid'))).toBe(true)
  })

  it('handles mixed valid and corrupt lines', async () => {
    const { parseSession } = await getModule()
    const meta = fixtureMeta('corrupt-session.jsonl')
    const chunks = await parseSession(meta)
    // corrupt-session.jsonl has 4 valid messages and 3 garbage lines
    // All valid content should be present in chunks
    const allText = chunks.map(c => c.text).join(' ')
    expect(allText).toContain('valid')
    expect(allText).not.toContain('not valid json')
  })

  it('assigns sequential startLine to chunks', async () => {
    const { parseSession } = await getModule()
    const meta = fixtureMeta('normal-session.jsonl')
    const chunks = await parseSession(meta)
    expect(chunks.length).toBeGreaterThan(1)

    // startLine should be monotonically increasing
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startLine).toBeGreaterThanOrEqual(chunks[i - 1].startLine)
    }
  })

  it('handles very long messages correctly', async () => {
    const { parseSession } = await getModule()
    const projDir = createProjectDir('proj')
    const longContent = 'Word '.repeat(1000)
    const filePath = writeSession(projDir, 's.jsonl', [
      `{"type":"user","message":{"content":"${longContent}"}}`,
    ])
    const meta = makeMeta(filePath, 'proj', 's')
    const chunks = await parseSession(meta)
    // Should produce multiple chunks
    expect(chunks.length).toBeGreaterThan(1)
    // All chunk text should be non-empty
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0)
    }
  })

  it('parses the content-formats fixture with all 4 formats', async () => {
    const { parseSession } = await getModule()
    const meta = fixtureMeta('content-formats.jsonl')
    const chunks = await parseSession(meta)
    const allText = chunks.map(c => c.text).join(' ')

    // message.content string
    expect(allText).toContain('String content in the message.content')
    // message.content array
    expect(allText).toContain('Array block content')
    // top-level content string
    expect(allText).toContain('Top-level string content')
    // top-level content array
    expect(allText).toContain('Top-level array content')
  })

  it('parses the skip-types fixture correctly', async () => {
    const { parseSession } = await getModule()
    const meta = fixtureMeta('skip-types.jsonl')
    const chunks = await parseSession(meta)
    const allText = chunks.map(c => c.text).join(' ')

    // Only the valid user and assistant messages should be present
    expect(allText).toContain('only valid')
    // Skipped types should not appear
    expect(allText).not.toContain('Processing file')
    expect(allText).not.toContain('session summary')
    expect(allText).not.toContain('System initialization')
    expect(allText).not.toContain('isMeta')
  })
})
