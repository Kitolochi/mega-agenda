import https from 'https'
import http from 'http'

export interface RSSFeed {
  url: string
  name: string
  category: string
}

export interface FeedItem {
  id: string
  title: string
  description: string
  link: string
  author: string
  pubDate: string
  feedName: string
}

function fetchURL(url: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'))

    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'MegaAgenda/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirect = res.headers.location
        if (redirect.startsWith('/')) {
          const parsed = new URL(url)
          redirect = `${parsed.protocol}//${parsed.host}${redirect}`
        }
        return resolve(fetchURL(redirect, maxRedirects - 1))
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataPattern = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i')
  const cdataMatch = xml.match(cdataPattern)
  if (cdataMatch) return cdataMatch[1].trim()

  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = xml.match(pattern)
  return match ? match[1].trim() : ''
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const pattern = new RegExp(`<${tag}[^>]*?${attr}="([^"]*)"`, 'i')
  const match = xml.match(pattern)
  return match ? match[1].trim() : ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRSSItems(xml: string, feedName: string): FeedItem[] {
  const items: FeedItem[] = []

  // Try RSS 2.0 format
  const rssItemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi
  let match

  while ((match = rssItemPattern.exec(xml)) !== null) {
    const itemXml = match[1]
    const title = stripHtml(extractTag(itemXml, 'title'))
    const rawDesc = extractTag(itemXml, 'description') || extractTag(itemXml, 'content:encoded')
    const description = stripHtml(rawDesc).slice(0, 300)
    const link = extractTag(itemXml, 'link') || extractTag(itemXml, 'guid')
    const author = stripHtml(extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator'))
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date')

    if (title) {
      items.push({
        id: link || `${feedName}-${items.length}`,
        title,
        description,
        link,
        author,
        pubDate,
        feedName,
      })
    }
  }

  // Try Atom format if no RSS items found
  if (items.length === 0) {
    const atomEntryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi
    while ((match = atomEntryPattern.exec(xml)) !== null) {
      const entryXml = match[1]
      const title = stripHtml(extractTag(entryXml, 'title'))
      const rawDesc = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content')
      const description = stripHtml(rawDesc).slice(0, 300)
      const link = extractAttr(entryXml, 'link', 'href') || extractTag(entryXml, 'link')
      const author = stripHtml(extractTag(entryXml, 'name'))
      const pubDate = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated')

      if (title) {
        items.push({
          id: extractTag(entryXml, 'id') || link || `${feedName}-${items.length}`,
          title,
          description,
          link,
          author,
          pubDate,
          feedName,
        })
      }
    }
  }

  return items
}

export async function fetchFeed(feed: RSSFeed): Promise<FeedItem[]> {
  try {
    const xml = await fetchURL(feed.url)
    return parseRSSItems(xml, feed.name)
  } catch (err: any) {
    console.error(`Failed to fetch feed ${feed.name}:`, err.message)
    return []
  }
}

export async function fetchAllFeeds(feeds: RSSFeed[]): Promise<FeedItem[]> {
  const results = await Promise.all(feeds.map(f => fetchFeed(f)))
  const allItems = results.flat()
  allItems.sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0
    const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0
    return dateB - dateA
  })
  return allItems
}
