import { describe, it, expect } from 'vitest'
import { cn } from '../utils/cn'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('returns empty string for no classes', () => {
    expect(cn()).toBe('')
  })

  it('handles conditional classes', () => {
    const active = true
    const disabled = false
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active')
  })
})
