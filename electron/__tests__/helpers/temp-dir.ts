import fs from 'fs'
import path from 'path'
import os from 'os'

export function createTempDir(prefix = 'mega-agenda-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export function cleanupTempDir(dir: string): void {
  try {
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  } catch {}
}
