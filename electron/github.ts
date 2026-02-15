import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

export interface GitHubRepoResult {
  name: string
  fullName: string
  description: string
  url: string
  localPath: string | null
  language: string
  updatedAt: string
}

const CLONE_LOCATIONS = [
  '',           // ~/name
  'projects',   // ~/projects/name
  'dev',        // ~/dev/name
  'repos',      // ~/repos/name
  'code',       // ~/code/name
  'src',        // ~/src/name
  'github',     // ~/github/name
  'Documents',  // ~/Documents/name
  'Desktop',    // ~/Desktop/name
]

function findLocalClone(repoName: string): string | null {
  const home = os.homedir()
  for (const loc of CLONE_LOCATIONS) {
    const candidate = loc ? path.join(home, loc, repoName) : path.join(home, repoName)
    try {
      const gitDir = path.join(candidate, '.git')
      if (fs.existsSync(gitDir)) return candidate
    } catch {}
  }
  return null
}

export async function searchGitHubRepos(query: string): Promise<GitHubRepoResult[]> {
  return new Promise((resolve) => {
    execFile(
      'gh',
      ['repo', 'list', '--json', 'name,nameWithOwner,description,url,primaryLanguage,updatedAt', '-L', '30'],
      { timeout: 10000 },
      (error, stdout) => {
        if (error || !stdout) {
          resolve([])
          return
        }

        try {
          const repos: any[] = JSON.parse(stdout)
          const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)

          const matches = repos.filter(repo => {
            const name = (repo.name || '').toLowerCase()
            const desc = (repo.description || '').toLowerCase()
            return queryWords.some(w => name.includes(w) || desc.includes(w))
          })

          const results: GitHubRepoResult[] = matches.slice(0, 10).map(repo => ({
            name: repo.name || '',
            fullName: repo.nameWithOwner || '',
            description: repo.description || '',
            url: repo.url || '',
            localPath: findLocalClone(repo.name || ''),
            language: repo.primaryLanguage?.name || '',
            updatedAt: repo.updatedAt || '',
          }))

          resolve(results)
        } catch {
          resolve([])
        }
      }
    )
  })
}
