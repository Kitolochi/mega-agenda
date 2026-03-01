import { describe, it, expect } from 'vitest'
import { priorityColors, formatDate, formatRelativeTime, generateId } from '../utils/formatting'

describe('priorityColors', () => {
  it('maps priority 1 to red', () => {
    expect(priorityColors[1]).toBe('border-accent-red')
  })
  it('maps priority 2 to amber', () => {
    expect(priorityColors[2]).toBe('border-accent-amber')
  })
  it('maps priority 3 to subtle', () => {
    expect(priorityColors[3]).toBe('border-subtle')
  })
})

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2025-01-15T12:00:00Z')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    const result = formatRelativeTime(new Date().toISOString())
    expect(result).toBe('just now')
  })

  it('returns minutes for recent past', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
    const result = formatRelativeTime(fiveMinAgo)
    expect(result).toBe('5m ago')
  })
})

describe('generateId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('generates string IDs', () => {
    expect(typeof generateId()).toBe('string')
  })
})
