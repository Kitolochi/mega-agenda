import { useState, useEffect } from 'react'
import { useCommandCenterStore } from '../../store/commandCenterStore'
import { Button, Input, Dialog } from '../ui'
import { Rocket, FolderOpen } from 'lucide-react'

export default function LaunchCard() {
  const { projects, launch, setLaunchOpen, loadProjects } = useCommandCenterStore()
  const [projectPath, setProjectPath] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('sonnet')
  const [maxBudget, setMaxBudget] = useState('')

  useEffect(() => { loadProjects() }, [])

  const handleBrowse = async () => {
    const result = await window.electronAPI.ccBrowseProject()
    if (result) {
      setProjectPath(result.path)
      loadProjects()
    }
  }

  const handleLaunch = () => {
    if (!projectPath || !prompt.trim()) return
    const modelMap: Record<string, string> = {
      opus: 'claude-opus-4-6',
      sonnet: 'claude-sonnet-4-5-20250929',
      haiku: 'claude-haiku-4-5-20251001',
    }
    launch(projectPath, prompt.trim(), {
      model: modelMap[model],
      maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
    })
  }

  const canLaunch = projectPath && prompt.trim()

  return (
    <Dialog open onClose={() => setLaunchOpen(false)} className="mt-16">
      <div className="bg-surface-1 border border-white/[0.08] rounded-xl w-[480px] p-5">
        <h2 className="text-sm font-semibold text-white/90 mb-4">New Task</h2>

        {/* Project */}
        <div className="mb-3">
          <label className="text-[11px] text-muted font-medium mb-1 block">Project</label>
          <div className="flex gap-2">
            <select
              value={projectPath}
              onChange={e => setProjectPath(e.target.value)}
              className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-accent-blue/40"
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.path} value={p.path}>{p.name} — {p.path}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={handleBrowse}>
              <FolderOpen size={14} />
            </Button>
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-3">
          <label className="text-[11px] text-muted font-medium mb-1 block">Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="What should Claude do?"
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 placeholder-white/20 focus:outline-none focus:border-accent-blue/40 resize-none min-h-[80px]"
            rows={3}
          />
        </div>

        {/* Model + Budget row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="text-[11px] text-muted font-medium mb-1 block">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-accent-blue/40"
            >
              <option value="sonnet">Sonnet</option>
              <option value="opus">Opus</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>
          <div className="flex-1">
            <Input
              label="Max Budget (USD)"
              type="number"
              step="0.50"
              min="0"
              value={maxBudget}
              onChange={e => setMaxBudget(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLaunchOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleLaunch}
            disabled={!canLaunch}
          >
            <Rocket size={12} /> Launch
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
