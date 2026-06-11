import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'
import type { AppSettings, SaveSettingsArgs } from '../shared/types'

/** What actually sits in userData/settings.json. The full key never leaves the main process. */
interface StoredSettings {
  apiKey?: string
  model?: string
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

function loadStored(): StoredSettings {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf-8'))
  } catch {
    return {}
  }
}

/** Key to use for API calls: in-app setting wins, .env is the fallback. */
export function effectiveApiKey(): string | undefined {
  return loadStored().apiKey || process.env.ANTHROPIC_API_KEY || undefined
}

/** Model to use for API calls: in-app setting wins, then .env, then the default. */
export function effectiveModel(): string {
  return loadStored().model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
}

export function saveSettings(args: SaveSettingsArgs): void {
  const next = { ...loadStored() }
  if (args.apiKey?.trim()) next.apiKey = args.apiKey.trim()
  if (args.model?.trim()) next.model = args.model.trim()
  fs.writeFileSync(file(), JSON.stringify(next, null, 2))
}

/** Renderer-safe view of the settings: the key is masked, never sent in full. */
export function getAppSettings(): AppSettings {
  const stored = loadStored()
  const key = effectiveApiKey()
  return {
    model: effectiveModel(),
    modelSource: stored.model ? 'settings' : process.env.ANTHROPIC_MODEL ? 'env' : 'default',
    maskedApiKey: key ? `${key.slice(0, 10)}…${key.slice(-4)}` : null,
    keySource: stored.apiKey ? 'settings' : key ? 'env' : 'none'
  }
}
