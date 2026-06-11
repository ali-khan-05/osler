import { useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import { useLatestStatus } from '../logs'

interface Props {
  onCreated: (set: QuestionSet) => void
  onCancel: () => void
}

const COUNTS = [5, 10, 15, 20]

export default function NewSet({ onCreated, onCancel }: Props): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = useLatestStatus('generate')

  const fileName = filePath?.split('/').pop() ?? null

  const pickFile = async (): Promise<void> => {
    const path = await window.api.pickFile()
    if (path) {
      setFilePath(path)
      if (!title) {
        const base = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
        setTitle(base)
      }
    }
  }

  const generate = async (): Promise<void> => {
    if (!filePath) return
    setLoading(true)
    setError(null)
    try {
      const set = await window.api.generateSet({
        filePath,
        title: title.trim() || fileName || 'Untitled set',
        count
      })
      onCreated(set)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <button onClick={onCancel} className="mb-8 text-sm text-ink-500 hover:text-ink-900">
        ← Back
      </button>
      <h1 className="font-display text-3xl text-ink-900">New question set</h1>
      <p className="mt-1 text-ink-500">Upload lecture slides as a PDF (export from PowerPoint if needed).</p>

      <div className="mt-8 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Lecture file</label>
          <button
            onClick={pickFile}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-cream-400 bg-cream-50 px-6 py-5 text-left transition hover:border-accent-600/50 hover:bg-white disabled:opacity-50"
          >
            <span className={fileName ? 'text-ink-900' : 'text-ink-500'}>
              {fileName ?? 'Choose a PDF, image, or text file…'}
            </span>
            <span className="text-sm font-medium text-accent-600">Browse</span>
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Set title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            placeholder="e.g. Cardiology — Arrhythmias"
            className="w-full rounded-2xl border border-cream-300 bg-white px-5 py-3 text-ink-900 placeholder:text-ink-500/60 focus:border-accent-600/60 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Number of questions</label>
          <div className="flex gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                disabled={loading}
                className={`rounded-full px-5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  count === c
                    ? 'bg-accent-600 text-cream-50'
                    : 'border border-cream-300 bg-cream-50 text-ink-700 hover:border-accent-600/40'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-600/30 bg-rose-100 px-5 py-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={!filePath || loading}
          className="w-full rounded-full bg-accent-600 py-3.5 font-medium text-cream-50 transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Generating…' : 'Generate questions'}
        </button>

        {loading && (
          <div className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 px-5 py-4">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent-600" />
            <p className="text-sm text-ink-700">
              {status ?? 'Starting…'}
              <span className="mt-0.5 block text-xs text-ink-500">
                A full set takes a minute or two. Open the log at the bottom (⌘`) for detail.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
