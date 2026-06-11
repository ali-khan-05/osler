import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'
import type { QuestionSet } from '../shared/types'

function setsDir(): string {
  const dir = join(app.getPath('userData'), 'question-sets')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function listSets(): QuestionSet[] {
  const dir = setsDir()
  const sets: QuestionSet[] = []
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    try {
      sets.push(JSON.parse(fs.readFileSync(join(dir, file), 'utf-8')))
    } catch {
      // skip corrupted files rather than crash the whole list
    }
  }
  sets.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return sets
}

export function getSet(id: string): QuestionSet | null {
  const file = join(setsDir(), `${id}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

export function saveSet(set: QuestionSet): void {
  fs.writeFileSync(join(setsDir(), `${set.id}.json`), JSON.stringify(set, null, 2))
}

export function deleteSet(id: string): void {
  const file = join(setsDir(), `${id}.json`)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}
