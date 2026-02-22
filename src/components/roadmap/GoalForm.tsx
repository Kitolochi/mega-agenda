import { useState } from 'react'
import { RoadmapGoal, RoadmapGoalCategory } from '../../types'
import { CATEGORIES } from './constants'
import DynamicList from './DynamicList'

interface GoalFormProps {
  initial: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'> | RoadmapGoal
  onSave: (data: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

export default function GoalForm({ initial, onSave, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [category, setCategory] = useState<RoadmapGoalCategory>(initial.category)
  const [researchQuestions, setResearchQuestions] = useState<string[]>(initial.research_questions)
  const [guidanceNeeded, setGuidanceNeeded] = useState<string[]>(initial.guidance_needed)

  const handleSave = () => {
    if (!title.trim()) return
    const cur = new Date()
    onSave({
      title: title.trim(),
      description,
      category,
      targetQuarter: Math.ceil((cur.getMonth() + 1) / 3) as 1 | 2 | 3 | 4,
      targetYear: cur.getFullYear(),
      priority: 'medium',
      status: initial.status || 'not_started',
      research_questions: researchQuestions.filter(q => q.trim()),
      guidance_needed: guidanceNeeded.filter(g => g.trim()),
      notes: (initial as RoadmapGoal).notes || '',
      sub_goals: (initial as RoadmapGoal).sub_goals || [],
      tags: (initial as RoadmapGoal).tags || [],
      topicReports: (initial as RoadmapGoal).topicReports || [],
    })
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-1/60 p-4 mb-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What's the goal?"
        className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-blue/40"
        autoFocus
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Brief description..."
        rows={2}
        className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted focus:outline-none focus:border-accent-blue/40 resize-none"
      />

      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              category === c.id ? 'text-white' : 'text-muted/60 hover:text-muted'
            }`}
            style={category === c.id ? { backgroundColor: c.color + '30', color: c.color } : {}}
          >{c.label}</button>
        ))}
      </div>

      <DynamicList
        label="What should the AI research?"
        items={researchQuestions}
        onChange={setResearchQuestions}
        placeholder="e.g. Best approach for..."
      />

      <DynamicList
        label="What guidance do you need?"
        items={guidanceNeeded}
        onChange={setGuidanceNeeded}
        placeholder="e.g. How to handle..."
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="px-4 py-1.5 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all disabled:opacity-30"
        >Save</button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-muted text-xs font-medium hover:text-white/70 transition-all"
        >Cancel</button>
      </div>
    </div>
  )
}
