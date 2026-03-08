import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../utils/markdown'

describe('renderMarkdown', () => {
  it('renders inline code', () => {
    const result = renderMarkdown('use `console.log` here')
    expect(result).toContain('<code')
    expect(result).toContain('console.log')
  })

  it('renders bold text', () => {
    const result = renderMarkdown('this is **bold** text')
    expect(result).toContain('<strong')
    expect(result).toContain('bold')
  })

  it('renders bullet lists', () => {
    const result = renderMarkdown('- item one\n- item two')
    expect(result).toContain('item one')
    expect(result).toContain('item two')
  })

  it('renders code blocks', () => {
    const result = renderMarkdown('```js\nconst x = 1\n```')
    expect(result).toContain('<pre')
    expect(result).toContain('const x = 1')
  })

  it('converts newlines to br', () => {
    const result = renderMarkdown('line one\nline two')
    expect(result).toContain('<br/>')
  })

  it('escapes HTML to prevent XSS', () => {
    const result = renderMarkdown('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
    expect(result).toContain('&quot;')
  })

  it('escapes HTML but still renders markdown syntax', () => {
    const result = renderMarkdown('**bold** and <img onerror=alert(1)>')
    expect(result).toContain('<strong')
    expect(result).toContain('bold')
    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;img')
  })
})
