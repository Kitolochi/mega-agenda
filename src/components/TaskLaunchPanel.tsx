import { useState, useEffect, useCallback } from 'react'
import { AITask, GitHubRepoResult } from '../types'

interface CLISearchResult {
  sessionId: string
  firstPrompt: string
  matches: string[]
  project: string
}

type Phase = 'searching_cli' | 'searching_github' | 'done'

interface TaskLaunchPanelProps {
  task: AITask
  onClose: () => void
  onExecute: (command: string) => void
}

export default function TaskLaunchPanel({ task, onClose, onExecute }: TaskLaunchPanelProps) {
  const [phase, setPhase] = useState<Phase>('searching_cli')
  const [cliResults, setCliResults] = useState<CLISearchResult[]>([])
  const [githubResults, setGithubResults] = useState<GitHubRepoResult[]>([])

  const buildQueries = useCallback(() => {
    const queries: string[] = [task.title]
    if (task.tags.length > 0) {
      queries.push(task.tags.join(' '))
    }
    // Extract significant words from description (skip short/common words)
    if (task.description) {
      const words = task.description.split(/\s+/).filter(w => w.length > 4).slice(0, 5)
      if (words.length > 0) queries.push(words.join(' '))
    }
    return queries
  }, [task])

  useEffect(() => {
    let cancelled = false

    async function search() {
      // Phase 1: Search CLI sessions
      setPhase('searching_cli')
      const queries = buildQueries()
      const seen = new Set<string>()
      const allCliResults: CLISearchResult[] = []

      for (const query of queries) {
        try {
          const results = await window.electronAPI.searchCliSessions(query)
          for (const r of results) {
            if (!seen.has(r.sessionId)) {
              seen.add(r.sessionId)
              allCliResults.push(r)
            }
          }
        } catch {}
      }

      if (cancelled) return
      setCliResults(allCliResults.slice(0, 10))

      if (allCliResults.length > 0) {
        setPhase('done')
        return
      }

      // Phase 2: Search GitHub repos
      setPhase('searching_github')
      try {
        const repos = await window.electronAPI.searchGitHubRepos(task.title)
        if (!cancelled) setGithubResults(repos)
      } catch {}

      if (!cancelled) setPhase('done')
    }

    search()
    return () => { cancelled = true }
  }, [buildQueries, task.title])

  const handleAction = (command: string) => {
    onExecute(command)
    onClose()
  }

  const escapePrompt = (text: string) => text.replace(/"/g, '\\"').replace(/\n/g, ' ')

  const newSessionPrompt = `${task.title}${task.description ? ': ' + task.description : ''}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[420px] max-h-[80vh] rounded-xl bg-surface-2 border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-accent-amber/20 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/90 truncate">Launch Task</p>
              <p className="text-[10px] text-muted truncate">{task.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 10 10">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Search progress */}
        {phase !== 'done' && (
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-accent-blue/40 border-t-accent-blue rounded-full animate-spin" />
            <span className="text-[11px] text-white/60">
              {phase === 'searching_cli' ? 'Searching CLI sessions...' : 'Searching GitHub repos...'}
            </span>
          </div>
        )}

        {/* Phase indicators */}
        {phase === 'done' && (
          <div className="px-4 py-2 border-b border-white/[0.04] flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${cliResults.length > 0 ? 'bg-accent-emerald' : 'bg-white/20'}`} />
              <span className="text-[10px] text-muted">CLI: {cliResults.length} found</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${githubResults.length > 0 ? 'bg-accent-emerald' : 'bg-white/20'}`} />
              <span className="text-[10px] text-muted">GitHub: {githubResults.length} found</span>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* CLI session results */}
          {cliResults.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">CLI Sessions</p>
              <div className="space-y-1.5">
                {cliResults.map(result => (
                  <div
                    key={result.sessionId}
                    className="rounded-lg bg-surface-3/60 border border-white/[0.04] p-2.5 hover:border-white/[0.08] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/80 font-medium truncate">
                          {result.firstPrompt || result.sessionId.slice(0, 12)}
                        </p>
                        {result.project && (
                          <p className="text-[9px] text-muted mt-0.5">{result.project}</p>
                        )}
                        {result.matches[0] && (
                          <p className="text-[9px] text-white/40 mt-1 line-clamp-2">
                            ...{result.matches[0]}...
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAction(`claude --resume ${result.sessionId}\r`)}
                        className="shrink-0 text-[10px] px-2.5 py-1 rounded-md bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 font-medium transition-all"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GitHub repo results */}
          {githubResults.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">GitHub Repos</p>
              <div className="space-y-1.5">
                {githubResults.map(repo => (
                  <div
                    key={repo.fullName}
                    className="rounded-lg bg-surface-3/60 border border-white/[0.04] p-2.5 hover:border-white/[0.08] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/80 font-medium truncate">{repo.name}</p>
                        {repo.description && (
                          <p className="text-[9px] text-white/40 mt-0.5 line-clamp-2">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {repo.language && (
                            <span className="text-[9px] text-muted">{repo.language}</span>
                          )}
                          {repo.localPath && (
                            <span className="text-[9px] text-accent-emerald/70">Local clone found</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (repo.localPath) {
                            handleAction(`cd "${repo.localPath}" && claude\r`)
                          } else {
                            handleAction(`gh repo clone ${repo.fullName} && cd ${repo.name} && claude\r`)
                          }
                        }}
                        className="shrink-0 text-[10px] px-2.5 py-1 rounded-md bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 font-medium transition-all"
                      >
                        {repo.localPath ? 'Open' : 'Clone'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {phase === 'done' && cliResults.length === 0 && githubResults.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[11px] text-white/40">No existing context found for this task.</p>
              <p className="text-[10px] text-muted mt-1">Start a new Claude session below.</p>
            </div>
          )}
        </div>

        {/* Start New Session button (always visible) */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => handleAction(`claude "${escapePrompt(newSessionPrompt)}"\r`)}
            className="w-full py-2 rounded-lg bg-accent-amber/20 text-accent-amber hover:bg-accent-amber/30 text-[11px] font-semibold transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Start New Session
          </button>
        </div>
      </div>
    </div>
  )
}
