import { create } from 'zustand'
import type {
  AVStats, AVSummary, AVTools, AVVelocity, AVHeatmap,
  AVProjects, AVSessions, AVTopSessions, AVSessionList,
  AVInsights, AVSyncStatus,
} from '../types'

type SubView = 'overview' | 'tools' | 'velocity' | 'sessions' | 'insights'

interface SessionsState {
  subView: SubView
  online: boolean | null
  loading: boolean
  error: string | null
  lastRefresh: number | null

  stats: AVStats | null
  summary: AVSummary | null
  tools: AVTools | null
  velocity: AVVelocity | null
  heatmap: AVHeatmap | null
  projects: AVProjects | null
  sessions: AVSessions | null
  topSessions: AVTopSessions | null
  sessionList: AVSessionList | null
  insights: AVInsights | null
  syncStatus: AVSyncStatus | null

  setSubView: (v: SubView) => void
  checkOnline: () => Promise<boolean>
  loadAll: () => Promise<void>
  loadOverview: () => Promise<void>
  loadTools: () => Promise<void>
  loadVelocity: () => Promise<void>
  loadSessions: () => Promise<void>
  loadInsights: () => Promise<void>
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  subView: 'overview',
  online: null,
  loading: false,
  error: null,
  lastRefresh: null,

  stats: null,
  summary: null,
  tools: null,
  velocity: null,
  heatmap: null,
  projects: null,
  sessions: null,
  topSessions: null,
  sessionList: null,
  insights: null,
  syncStatus: null,

  setSubView: (v) => {
    set({ subView: v })
    const s = get()
    if (v === 'tools' && !s.tools) s.loadTools()
    else if (v === 'velocity' && !s.velocity) s.loadVelocity()
    else if (v === 'sessions' && !s.sessions) s.loadSessions()
    else if (v === 'insights' && !s.insights) s.loadInsights()
  },

  checkOnline: async () => {
    try {
      const ok = await window.electronAPI.avPing()
      set({ online: ok })
      return ok
    } catch {
      set({ online: false })
      return false
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null })
    const ok = await get().checkOnline()
    if (!ok) {
      set({ loading: false })
      return
    }
    try {
      const [stats, summary, heatmap, projects, topSessions, syncStatus] = await Promise.all([
        window.electronAPI.avGetStats(),
        window.electronAPI.avGetSummary(),
        window.electronAPI.avGetHeatmap(),
        window.electronAPI.avGetProjects(),
        window.electronAPI.avGetTopSessions(),
        window.electronAPI.avGetSyncStatus(),
      ])
      set({ stats, summary, heatmap, projects, topSessions, syncStatus, lastRefresh: Date.now(), loading: false })
    } catch (e: any) {
      set({ error: e.message || 'Failed to load data', loading: false })
    }
  },

  loadOverview: async () => {
    set({ loading: true, error: null })
    try {
      const [summary, heatmap, projects, topSessions] = await Promise.all([
        window.electronAPI.avGetSummary(),
        window.electronAPI.avGetHeatmap(),
        window.electronAPI.avGetProjects(),
        window.electronAPI.avGetTopSessions(),
      ])
      set({ summary, heatmap, projects, topSessions, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadTools: async () => {
    set({ loading: true, error: null })
    try {
      const tools = await window.electronAPI.avGetTools()
      set({ tools, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadVelocity: async () => {
    set({ loading: true, error: null })
    try {
      const velocity = await window.electronAPI.avGetVelocity()
      set({ velocity, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadSessions: async () => {
    set({ loading: true, error: null })
    try {
      const [sessions, sessionList] = await Promise.all([
        window.electronAPI.avGetSessions(),
        window.electronAPI.avGetSessionList(50),
      ])
      set({ sessions, sessionList, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  loadInsights: async () => {
    set({ loading: true, error: null })
    try {
      const [insights, syncStatus] = await Promise.all([
        window.electronAPI.avGetInsights(),
        window.electronAPI.avGetSyncStatus(),
      ])
      set({ insights, syncStatus, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },
}))
