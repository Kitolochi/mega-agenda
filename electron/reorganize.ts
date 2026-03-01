import fs from 'fs'
import path from 'path'
import { callLLM } from './llm'

export interface ReorgPlanItem {
  action: 'move' | 'merge' | 'delete'
  source: string       // relative path from memory dir
  destination?: string  // relative path for move/merge target
  reason: string
}

export interface ReorgPlan {
  items: ReorgPlanItem[]
  summary: string
  backupPath?: string
}

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

function scanFiles(dir: string, base: string): { path: string; content: string; size: number }[] {
  const results: { path: string; content: string; size: number }[] = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, base))
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (['.md', '.txt', '.json', '.yaml', '.yml'].includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const relativePath = path.relative(base, fullPath).replace(/\\/g, '/')
          results.push({ path: relativePath, content, size: content.length })
        } catch {}
      }
    }
  }
  return results
}

export async function generateReorgPlan(): Promise<ReorgPlan> {
  const memoryDir = getMemoryDir()
  const files = scanFiles(memoryDir, memoryDir)

  if (files.length === 0) {
    return { items: [], summary: 'No files found to reorganize.' }
  }

  // Build a summary of current file structure for the AI
  const fileList = files.map(f => {
    const preview = f.content.slice(0, 300).replace(/\n/g, ' ')
    return `- **${f.path}** (${f.size} chars): ${preview}...`
  }).join('\n')

  const prompt = `You are organizing a personal knowledge base stored at ~/.claude/memory/. The ideal structure uses domain folders:
- domains/career/ (profile.md, goals.md, current_state.md, history.md)
- domains/health/ (profile.md, goals.md, current_state.md, history.md)
- domains/financial/ (same pattern)
- domains/relationships/
- domains/learning/
- domains/projects/
- domains/personal/
- domains/creative/
- goals/{goal-slug}/ (research files — leave these alone)
- Root files: learnings.md, decisions.md, patterns.md, projects.md

Current files:
${fileList}

Analyze the current structure and suggest a reorganization plan. For each file that should be moved, merged, or deleted:
1. Skip files already in the correct location
2. Skip the goals/ directory entirely (research files are auto-generated)
3. Merge duplicate or overlapping content
4. Move misplaced files to proper domain folders
5. Delete truly empty or placeholder files (but not template files with prompts)

Respond with ONLY a JSON object:
{
  "items": [
    {"action": "move", "source": "old/path.md", "destination": "new/path.md", "reason": "..."},
    {"action": "merge", "source": "file1.md", "destination": "domains/career/profile.md", "reason": "..."},
    {"action": "delete", "source": "empty-file.md", "reason": "..."}
  ],
  "summary": "Brief summary of changes"
}`

  const text = await callLLM({ prompt, tier: 'primary', maxTokens: 8000, timeout: 120000 })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in reorganization response')
  }
  const plan: ReorgPlan = JSON.parse(jsonMatch[0])
  if (!Array.isArray(plan.items)) plan.items = []
  return plan
}

export function previewReorgPlan(plan: ReorgPlan): string {
  if (plan.items.length === 0) return 'No changes needed.'
  const lines = [plan.summary, '']
  for (const item of plan.items) {
    switch (item.action) {
      case 'move':
        lines.push(`MOVE: ${item.source} -> ${item.destination}`)
        break
      case 'merge':
        lines.push(`MERGE: ${item.source} -> ${item.destination}`)
        break
      case 'delete':
        lines.push(`DELETE: ${item.source}`)
        break
    }
    lines.push(`  Reason: ${item.reason}`)
  }
  return lines.join('\n')
}

export async function executeReorgPlan(plan: ReorgPlan): Promise<{ success: boolean; backupPath: string }> {
  const memoryDir = getMemoryDir()

  // Create backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDir = path.join(path.dirname(memoryDir), `memory-backup-${timestamp}`)
  copyDirSync(memoryDir, backupDir)
  console.log(`Memory backup created at: ${backupDir}`)

  try {
    for (const item of plan.items) {
      const sourcePath = path.join(memoryDir, item.source)
      if (!fs.existsSync(sourcePath)) {
        console.log(`Skipping ${item.action} — source not found: ${item.source}`)
        continue
      }

      switch (item.action) {
        case 'move': {
          if (!item.destination) continue
          const destPath = path.join(memoryDir, item.destination)
          const destDir = path.dirname(destPath)
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
          fs.renameSync(sourcePath, destPath)
          console.log(`Moved: ${item.source} -> ${item.destination}`)
          break
        }
        case 'merge': {
          if (!item.destination) continue
          const destPath = path.join(memoryDir, item.destination)
          const destDir = path.dirname(destPath)
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
          const sourceContent = fs.readFileSync(sourcePath, 'utf-8')
          const existingContent = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf-8') : ''
          const merged = existingContent
            ? existingContent + '\n\n---\n\n<!-- Merged from ' + item.source + ' -->\n\n' + sourceContent
            : sourceContent
          fs.writeFileSync(destPath, merged, 'utf-8')
          fs.unlinkSync(sourcePath)
          console.log(`Merged: ${item.source} -> ${item.destination}`)
          break
        }
        case 'delete': {
          fs.unlinkSync(sourcePath)
          console.log(`Deleted: ${item.source}`)
          break
        }
      }
    }

    // Clean up empty directories
    cleanEmptyDirs(memoryDir)

    return { success: true, backupPath: backupDir }
  } catch (err) {
    console.error('Reorg execution failed:', err)
    return { success: false, backupPath: backupDir }
  }
}

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function cleanEmptyDirs(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name)
      cleanEmptyDirs(fullPath)
      try {
        const remaining = fs.readdirSync(fullPath)
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath)
        }
      } catch {}
    }
  }
}
