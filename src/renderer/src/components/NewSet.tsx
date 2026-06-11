import { useEffect, useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import { useLatestStatus } from '../logs'
import { ArrowLeftIcon } from './icons'

interface Props {
  onCreated: (set: QuestionSet, generating: boolean) => void
  onCancel: () => void
}

const COUNTS = [5, 10, 15, 20]

function ShimmerLine({ className }: { className?: string }): React.JSX.Element {
  return (
    <div
      className={`h-1.5 animate-[shimmer_1.8s_linear_infinite] rounded ${className ?? ''}`}
      style={{
        background:
          'linear-gradient(90deg, var(--color-cream-200) 25%, var(--color-cream-300) 50%, var(--color-cream-200) 75%)',
        backgroundSize: '200% 100%'
      }}
    />
  )
}

/** Shown while the first batch of questions is being written. */
function GenerationLoader({ status }: { status: string | null }): React.JSX.Element {
  return (
    <div className="mt-12 flex animate-[rise-in_300ms_ease-out] flex-col items-center">
      <div className="relative">
        {/* the rest of the batch, waiting behind */}
        <div className="absolute inset-0 -rotate-6 animate-[float_3.4s_ease-in-out_infinite] rounded-2xl border border-cream-300 bg-cream-50 shadow-sm" />
        <div className="absolute inset-0 rotate-3 animate-[float_2.8s_ease-in-out_0.5s_infinite] rounded-2xl border border-cream-300 bg-cream-50 shadow-sm" />
        {/* the question being written */}
        <div className="relative w-72 rounded-2xl border border-cream-300 bg-white p-5 shadow-md">
          <p className="text-left font-display text-sm text-accent-600">Q1</p>
          <ShimmerLine className="mt-3 w-full" />
          <ShimmerLine className="mt-2 w-5/6" />
          <div className="mt-2 flex items-center gap-1.5">
            <ShimmerLine className="w-1/2" />
            <span className="h-3 w-1 animate-pulse rounded-sm bg-accent-600" />
          </div>
          <div className="mt-4 space-y-2">
            {[
              { letter: 'A', w: 'w-3/5' },
              { letter: 'B', w: 'w-4/5' },
              { letter: 'C', w: 'w-1/2' }
            ].map((o) => (
              <div key={o.letter} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-200 text-[10px] font-semibold text-ink-700">
                  {o.letter}
                </span>
                <ShimmerLine className={o.w} />
              </div>
            ))}
          </div>
        </div>
        <span className="absolute -top-3 -right-5 h-2.5 w-2.5 animate-[float_3s_ease-in-out_infinite] rounded-full bg-accent-600/60" />
        <span className="absolute -bottom-2 -left-6 h-2 w-2 animate-[float_2.4s_ease-in-out_0.6s_infinite] rounded-full bg-sage-600/60" />
      </div>

      <div className="mt-9 flex items-center gap-2.5">
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ animationDelay: `${i * 160}ms` }}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-600"
            />
          ))}
        </span>
        <p className="text-sm text-ink-700">{status ?? 'Reading your lecture…'}</p>
      </div>
      <p className="mt-2 max-w-sm text-center text-xs text-ink-500">
        The quiz starts as soon as the first questions are ready — the rest keep generating while
        you answer. Open the log at the bottom (⌘`) for detail.
      </p>
    </div>
  )
}

export default function NewSet({ onCreated, onCancel }: Props): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [existingTopics, setExistingTopics] = useState<string[]>([])
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = useLatestStatus('generate')

  useEffect(() => {
    window.api.listTopics().then((topics) => {
      setExistingTopics([...topics].sort((a, b) => a.localeCompare(b)))
    })
  }, [])

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
      const { set, generating } = await window.api.generateSet({
        filePath,
        title: title.trim() || fileName || 'Untitled set',
        topic: topic.trim() || undefined,
        count
      })
      onCreated(set, generating)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <button
        onClick={onCancel}
        className="group mb-8 flex items-center gap-1.5 text-sm text-ink-500 transition-colors duration-200 hover:text-ink-900"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Back
      </button>
      <h1 className="font-display text-3xl text-ink-900">New question set</h1>
      <p className="mt-1 text-ink-500">Upload lecture slides as a PDF (export from PowerPoint if needed).</p>

      {loading ? (
        <GenerationLoader status={status} />
      ) : (
      <div className="mt-8 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Lecture file</label>
          <button
            onClick={pickFile}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-cream-400 bg-cream-50 px-6 py-5 text-left transition-all duration-200 enabled:hover:border-accent-600/50 enabled:hover:bg-white enabled:hover:shadow-sm enabled:active:scale-[0.99] disabled:opacity-50"
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
          <label className="mb-2 block text-sm font-medium text-ink-700">Topic (optional)</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            list="topic-suggestions"
            placeholder="e.g. Cardiology — groups this set on the home screen"
            className="w-full rounded-2xl border border-cream-300 bg-white px-5 py-3 text-ink-900 placeholder:text-ink-500/60 focus:border-accent-600/60 focus:outline-none disabled:opacity-50"
          />
          <datalist id="topic-suggestions">
            {existingTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-ink-700">Number of questions</label>
          <div className="flex gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                disabled={loading}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 enabled:active:scale-95 disabled:opacity-50 ${
                  count === c
                    ? 'bg-accent-600 text-cream-50 shadow-sm'
                    : 'border border-cream-300 bg-cream-50 text-ink-700 enabled:hover:border-accent-600/40 enabled:hover:shadow-sm'
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
          className="w-full rounded-full bg-accent-600 py-3.5 font-medium text-cream-50 shadow-sm transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:bg-accent-700 enabled:hover:shadow-md enabled:hover:shadow-accent-600/25 enabled:active:translate-y-0 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate questions
        </button>
      </div>
      )}
    </div>
  )
}
