import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { ArrowLeftIcon, CheckIcon } from './icons'

interface Props {
  onBack: () => void
}

const MODELS = [
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    blurb: 'Very cheap via OpenRouter (~4¢ per question set) with no free-tier queues — needs OpenRouter credit'
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super — free',
    blurb: 'Free via OpenRouter and usually fast — the best free choice. Needs an OpenRouter key below'
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nemotron 3 Ultra — free',
    blurb: 'Bigger free model, but often stuck in a long queue — if generation stalls, switch to Super'
  }
]

export default function Settings({ onBack }: Props): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [model, setModel] = useState('')
  const [orKeyInput, setOrKeyInput] = useState('')
  const [showOrKey, setShowOrKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      setModel(s.model)
    })
  }, [])

  const dirty = orKeyInput.trim() !== '' || (settings !== null && model !== settings.model)

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const next = await window.api.saveSettings({
        model: settings && model !== settings.model ? model : undefined,
        openrouterApiKey: orKeyInput.trim() || undefined
      })
      setSettings(next)
      setModel(next.model)
      setOrKeyInput('')
      setSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setSaving(false)
    }
  }

  const orKeyStatus = !settings
    ? ''
    : settings.openRouterKeySource === 'none'
      ? 'No OpenRouter key set — Osler cannot generate questions until you add one.'
      : settings.openRouterKeySource === 'env'
        ? `Currently using the key from the .env file (${settings.maskedOpenRouterKey}). Pasting a key here will replace it.`
        : `Key saved in the app (${settings.maskedOpenRouterKey}).`

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <button
        onClick={onBack}
        className="group mb-8 flex items-center gap-1.5 text-sm text-ink-500 transition-colors duration-200 hover:text-ink-900"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Back
      </button>
      <h1 className="font-display text-3xl text-ink-900">Settings</h1>
      <p className="mt-1 text-ink-500">Choose which AI model Osler uses and manage your API keys.</p>

      <div className="mt-8 space-y-8">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Model</label>
          <div className="space-y-2">
            {MODELS.map((m) => {
              const selected = model.startsWith(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-6 py-4 text-left transition-all duration-200 active:scale-[0.99] ${
                    selected
                      ? 'border-accent-600 bg-white shadow-sm'
                      : 'border-cream-300 bg-cream-50 hover:border-accent-600/40 hover:shadow-sm'
                  }`}
                >
                  <div>
                    <p className="font-medium text-ink-900">{m.name}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{m.blurb}</p>
                  </div>
                  <span
                    className={`ml-4 h-4 w-4 shrink-0 rounded-full border-2 transition-all duration-200 ${
                      selected ? 'border-accent-600 bg-accent-600' : 'border-cream-400'
                    }`}
                  />
                </button>
              )
            })}
          </div>
          {settings && !MODELS.some((m) => settings.model.startsWith(m.id)) && model === settings.model && (
            <p className="mt-2 text-sm text-ink-500">
              Currently using a custom model: <span className="font-medium">{settings.model}</span>
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">OpenRouter API key</label>
          <div className="flex gap-2">
            <input
              type={showOrKey ? 'text' : 'password'}
              value={orKeyInput}
              onChange={(e) => setOrKeyInput(e.target.value)}
              disabled={saving}
              placeholder="sk-or-…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border border-cream-300 bg-white px-5 py-3 font-mono text-sm text-ink-900 placeholder:text-ink-500/60 focus:border-accent-600/60 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => setShowOrKey((v) => !v)}
              className="shrink-0 rounded-2xl border border-cream-300 bg-cream-50 px-4 text-sm text-ink-700 transition-all duration-200 hover:border-accent-600/40 hover:shadow-sm active:scale-95"
              title={showOrKey ? 'Hide key' : 'Show key'}
            >
              {showOrKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {orKeyStatus && <p className="mt-2 text-sm text-ink-500">{orKeyStatus}</p>}
          <p className="mt-1 text-sm text-ink-500">
            Create one free at{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-600 hover:underline"
            >
              openrouter.ai/keys
            </a>
            .
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-600/30 bg-rose-100 px-5 py-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-full bg-accent-600 px-8 py-3 font-medium text-cream-50 shadow-sm transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-accent-700 enabled:hover:shadow-md enabled:hover:shadow-accent-600/25 enabled:active:translate-y-0 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && !dirty && (
            <span className="flex animate-[pop-in_200ms_ease-out] items-center gap-1 text-sm font-medium text-sage-600">
              Saved <CheckIcon className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
