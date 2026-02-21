import { useState } from 'react'
import { RoadmapGoal, RoadmapGoalCategory, RoadmapGoalStatus, RoadmapSubGoal } from '../../types'
import { CATEGORIES, STATUSES, PRIORITIES, generateId } from './constants'
import DynamicList from './DynamicList'

interface GoalFormProps {
  initial: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'> | RoadmapGoal
  onSave: (data: Omit<RoadmapGoal, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
  onDelete?: () => void
  deleteConfirm?: boolean
  isEdit?: boolean
}

export default function GoalForm({ initial, onSave, onCancel, onDelete, deleteConfirm, isEdit }: GoalFormProps) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [category, setCategory] = useState<RoadmapGoalCategory>(initial.category)
  const [targetYear, setTargetYear] = useState(initial.targetYear)
  const [targetQuarter, setTargetQuarter] = useState<1 | 2 | 3 | 4>(initial.targetQuarter)
  const [priority, setPriority] = useState(initial.priority)
  const [status, setStatus] = useState<RoadmapGoalStatus>(initial.status)
  const [researchQuestions, setResearchQuestions] = useState<string[]>(initial.research_questions)
  const [guidanceNeeded, setGuidanceNeeded] = useState<string[]>(initial.guidance_needed)
  const [notes, setNotes] = useState(initial.notes)
  const [subGoals, setSubGoals] = useState<RoadmapSubGoal[]>(initial.sub_goals)
  const [tagsInput, setTagsInput] = useState(initial.tags.join(', '))

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description,
      category,
      targetQuarter,
      targetYear,
      priority,
      status,
      research_questions: researchQuestions.filter(q => q.trim()),
      guidance_needed: guidanceNeeded.filter(g => g.trim()),
      notes,
      sub_goals: subGoals.filter(s => s.title.trim()),
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      topicReports: (initial as RoadmapGoal).topicReports || [],
    })
  }

  const curYear = new Date().getFullYear()

  return (
    <div className={`${isEdit ? 'p-3' : 'rounded-xl border border-white/[0.08] bg-surface-1/60 p-4 mb-4'} space-y-3`}>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Goal title..."
        className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent-blue/40"
        autoFocus
      />

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description..."
        rows={2}
        className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted focus:outline-none focus:border-accent-blue/40 resize-none"
      />

      <div>
        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Category</label>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${
                category === c.id ? 'text-white border-white/20' : 'text-muted border-transparent hover:text-white/70'
              }`}
              style={category === c.id ? { backgroundColor: c.color + '30', borderColor: c.color + '50' } : {}}
            >{c.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Year</label>
          <select
            value={targetYear}
            onChange={e => setTargetYear(Number(e.target.value))}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {[curYear, curYear + 1, curYear + 2, curYear + 3, curYear + 4].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Quarter</label>
          <select
            value={targetQuarter}
            onChange={e => setTargetQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {([1, 2, 3, 4] as const).map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as typeof priority)}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as RoadmapGoalStatus)}
            className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          >
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-muted uppercase tracking-wider">Sub-goals</label>
          <button
            onClick={() => setSubGoals([...subGoals, { id: generateId(), title: '', status: 'not_started' }])}
            className="text-[10px] text-accent-blue hover:text-accent-blue/80"
          >+ Add</button>
        </div>
        {subGoals.map((sg, i) => (
          <div key={sg.id} className="flex items-center gap-1.5 mb-1">
            <select
              value={sg.status}
              onChange={e => {
                const updated = [...subGoals]
                updated[i] = { ...sg, status: e.target.value as RoadmapGoalStatus }
                setSubGoals(updated)
              }}
              className="bg-surface-3/50 border border-white/[0.06] rounded px-1 py-1 text-[10px] text-white focus:outline-none w-24"
            >
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input
              type="text"
              value={sg.title}
              onChange={e => {
                const updated = [...subGoals]
                updated[i] = { ...sg, title: e.target.value }
                setSubGoals(updated)
              }}
              placeholder="Sub-goal..."
              className="flex-1 bg-surface-3/50 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-white placeholder:text-muted focus:outline-none"
            />
            <button
              onClick={() => setSubGoals(subGoals.filter((_, j) => j !== i))}
              className="text-muted hover:text-accent-red text-xs px-1"
            >×</button>
          </div>
        ))}
      </div>

      <DynamicList
        label="Research Questions"
        items={researchQuestions}
        onChange={setResearchQuestions}
        placeholder="What do you need researched?"
      />

      <DynamicList
        label="Guidance Needed"
        items={guidanceNeeded}
        onChange={setGuidanceNeeded}
        placeholder="What guidance do you need?"
      />

      <div>
        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted focus:outline-none resize-none"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Tags <span className="text-muted/50">(comma-separated)</span></label>
        <input
          type="text"
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="e.g. saas, marketing, q2-launch"
          className="w-full bg-surface-3/50 border border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="px-3 py-1.5 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-all disabled:opacity-30"
        >
          {isEdit ? 'Save' : 'Create Goal'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-muted text-xs font-medium hover:text-white/70 transition-all"
        >Cancel</button>
        {isEdit && onDelete && (
          <button
            onClick={onDelete}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              deleteConfirm
                ? 'bg-accent-red/20 text-accent-red'
                : 'text-muted hover:text-accent-red'
            }`}
          >{deleteConfirm ? 'Confirm Delete' : 'Delete'}</button>
        )}
      </div>
    </div>
  )
}
