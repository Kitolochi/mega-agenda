import https from 'https'

export interface TwitterSettings {
  bearerToken: string
  listIds: { id: string; name: string }[]
}

export interface Tweet {
  id: string
  text: string
  authorName: string
  authorUsername: string
  authorAvatar: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  listName: string
}

function twitterGet(endpoint: string, bearerToken: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.twitter.com${endpoint}`)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject({ status: res.statusCode, ...parsed })
          } else {
            resolve(parsed)
          }
        } catch {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.end()
  })
}

export async function verifyToken(bearerToken: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Use a simple user lookup to verify the token - works on free tier
    await twitterGet('/2/users/by/username/twitter', bearerToken)
    return { valid: true }
  } catch (err: any) {
    if (err.status === 401) return { valid: false, error: 'Invalid bearer token' }
    if (err.status === 403) {
      const detail = err.detail || err.title || ''
      if (err.reason === 'client-not-enrolled') {
        return { valid: false, error: 'Your app needs to be attached to a project on the Twitter Developer Portal. Check your app settings at developer.x.com.' }
      }
      return { valid: false, error: detail || 'Token lacks required permissions.' }
    }
    // If we get a 429 (rate limit), the token is at least valid
    if (err.status === 429) return { valid: true }
    const errorMsg = err.detail || err.title || err.errors?.[0]?.message || err.message || 'Connection failed. Check your internet connection.'
    return { valid: false, error: errorMsg }
  }
}

export async function getUserLists(bearerToken: string, userId: string): Promise<{ id: string; name: string }[]> {
  try {
    const data = await twitterGet(`/2/users/${userId}/owned_lists?list.fields=name`, bearerToken)
    if (!data.data) return []
    return data.data.map((list: any) => ({ id: list.id, name: list.name }))
  } catch (err: any) {
    console.error('Failed to fetch lists:', err)
    return []
  }
}

export async function getAuthenticatedUser(bearerToken: string): Promise<{ id: string; username: string } | null> {
  // Bearer tokens (app-only) can't use /2/users/me, so we'll skip this
  // The user will need to provide their user ID or username
  return null
}

export async function getUserByUsername(bearerToken: string, username: string): Promise<{ id: string; username: string; name: string } | null> {
  try {
    const data = await twitterGet(`/2/users/by/username/${username}?user.fields=name`, bearerToken)
    if (!data.data) return null
    return { id: data.data.id, username: data.data.username, name: data.data.name }
  } catch {
    return null
  }
}

export async function getListTweets(bearerToken: string, listId: string, listName: string): Promise<Tweet[]> {
  try {
    const data = await twitterGet(
      `/2/lists/${listId}/tweets?max_results=15&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username,profile_image_url`,
      bearerToken
    )

    if (!data.data) return []

    const users = new Map<string, any>()
    if (data.includes?.users) {
      for (const user of data.includes.users) {
        users.set(user.id, user)
      }
    }

    return data.data.map((tweet: any) => {
      const author = users.get(tweet.author_id) || {}
      return {
        id: tweet.id,
        text: tweet.text,
        authorName: author.name || 'Unknown',
        authorUsername: author.username || 'unknown',
        authorAvatar: author.profile_image_url || '',
        createdAt: tweet.created_at || '',
        likeCount: tweet.public_metrics?.like_count || 0,
        retweetCount: tweet.public_metrics?.retweet_count || 0,
        replyCount: tweet.public_metrics?.reply_count || 0,
        listName,
      }
    })
  } catch (err: any) {
    console.error(`Failed to fetch tweets for list ${listId}:`, err)
    return []
  }
}

export async function fetchAllLists(bearerToken: string, lists: { id: string; name: string }[]): Promise<Tweet[]> {
  const results: Tweet[] = []
  for (const list of lists) {
    const tweets = await getListTweets(bearerToken, list.id, list.name)
    results.push(...tweets)
  }
  // Sort by most recent
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return results
}
