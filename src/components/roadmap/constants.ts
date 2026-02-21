import { RoadmapGoalCategory, RoadmapGoalStatus } from '../../types'

export const CATEGORIES: { id: RoadmapGoalCategory; label: string; color: string }[] = [
  { id: 'career', label: 'Career', color: '#6C8EEF' },
  { id: 'health', label: 'Health', color: '#34D399' },
  { id: 'financial', label: 'Financial', color: '#FBBF24' },
  { id: 'relationships', label: 'Relationships', color: '#F472B6' },
  { id: 'learning', label: 'Learning', color: '#A78BFA' },
  { id: 'projects', label: 'Projects', color: '#FB923C' },
  { id: 'personal', label: 'Personal', color: '#2DD4BF' },
  { id: 'creative', label: 'Creative', color: '#F87171' },
]

export const STATUSES: { id: RoadmapGoalStatus; label: string }[] = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'on_hold', label: 'On Hold' },
]

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export const PRIORITY_COLORS: Record<string, string> = { low: '#60a5fa', medium: '#fbbf24', high: '#fb923c', critical: '#f87171' }

export function catColor(cat: RoadmapGoalCategory): string {
  return CATEGORIES.find(c => c.id === cat)?.color || '#888'
}

export function statusIcon(s: RoadmapGoalStatus): string {
  return s === 'completed' ? 'x' : s === 'in_progress' ? '~' : s === 'on_hold' ? '-' : ' '
}

export function currentQuarter(): { q: number; y: number } {
  const now = new Date()
  return { q: Math.ceil((now.getMonth() + 1) / 3) as 1 | 2 | 3 | 4, y: now.getFullYear() }
}

export const emptyGoal = (): Omit<import('../../types').RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'> => {
  const cur = currentQuarter()
  return {
    title: '',
    description: '',
    category: 'projects',
    targetQuarter: cur.q as 1 | 2 | 3 | 4,
    targetYear: cur.y,
    priority: 'medium',
    status: 'not_started',
    research_questions: [],
    guidance_needed: [],
    notes: '',
    sub_goals: [],
    tags: [],
    topicReports: [],
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
