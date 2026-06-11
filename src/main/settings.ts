import { app } from 'electron'
import fs from 'fs'
import { join } from 'path'
import type { AppSettings, SaveSettingsArgs } from '../shared/types'

/** What actually sits in userData/settings.json. The full keys never leave the main process. */
interface StoredSettings {
  apiKey?: string
  openrouterApiKey?: string
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

/** Key for OpenRouter models: in-app setting wins, .env is the fallback. */
export function effectiveOpenRouterKey(): string | undefined {
  return loadStored().openrouterApiKey || process.env.OPENROUTER_API_KEY || undefined
}

/** Model to use for API calls: in-app setting wins, then .env, then the default. */
export function effectiveModel(): string {
  return loadStored().model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
}

/** OpenRouter model ids are namespaced like "nvidia/nemotron-…"; Claude ids have no slash. */
export function provider(): 'anthropic' | 'openrouter' {
  return effectiveModel().includes('/') ? 'openrouter' : 'anthropic'
}

/** API keys must be plain ASCII — smart dashes/ellipses picked up while copying break the HTTP header. */
function cleanKey(raw: string, label: string): string {
  const key = raw.trim()
  if (/[^\x21-\x7E]/.test(key)) {
    throw new Error(
      `The ${label} key contains an invalid character (often a "—" or "…" picked up while copying from chat or notes). Copy the key again directly from the provider's website and paste it here in one piece.`
    )
  }
  return key
}

export function saveSettings(args: SaveSettingsArgs): void {
  const next = { ...loadStored() }
  if (args.apiKey?.trim()) next.apiKey = cleanKey(args.apiKey, 'Anthropic')
  if (args.openrouterApiKey?.trim()) next.openrouterApiKey = cleanKey(args.openrouterApiKey, 'OpenRouter')
  if (args.model?.trim()) next.model = args.model.trim()
  fs.writeFileSync(file(), JSON.stringify(next, null, 2))
}

/** Renderer-safe view of the settings: the key is masked, never sent in full. */
export function getAppSettings(): AppSettings {
  const stored = loadStored()
  const key = effectiveApiKey()
  const orKey = effectiveOpenRouterKey()
  return {
    model: effectiveModel(),
    modelSource: stored.model ? 'settings' : process.env.ANTHROPIC_MODEL ? 'env' : 'default',
    maskedApiKey: key ? `${key.slice(0, 10)}…${key.slice(-4)}` : null,
    keySource: stored.apiKey ? 'settings' : key ? 'env' : 'none',
    maskedOpenRouterKey: orKey ? `${orKey.slice(0, 10)}…${orKey.slice(-4)}` : null,
    openRouterKeySource: stored.openrouterApiKey ? 'settings' : orKey ? 'env' : 'none'
  }
}
