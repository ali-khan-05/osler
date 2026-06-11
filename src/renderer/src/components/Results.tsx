import { useEffect, useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import { useLatestStatus } from '../logs'

interface Props {
  set: QuestionSet
  onRetake: () => void
  onHome: () => void
}

export default function Results({ set, onRetake, onHome }: Props): React.JSX.Element {
  const [report, setReport] = useState<string | null>(set.coachReport)
  const [loading, setLoading] = useState(!set.coachReport)
  const [error, setError] = useState<string | null>(null)
  const status = useLatestStatus('coach')

  const total = set.questions.length
  const correct = set.questions.filter((q, i) => set.answers[i] === q.correctIndex).length
  const pct = Math.round((correct / total) * 100)

  useEffect(() => {
    if (set.coachReport) return
    let cancelled = false
    window.api
      .getCoach(set.id)
      .then((r) => {
        if (!cancelled) {
          setReport(r)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          setError(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [set.id, set.coachReport])

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <button onClick={onHome} className="mb-8 text-sm text-ink-500 hover:text-ink-900">
        ← Home
      </button>

      <div className="rounded-2xl border border-cream-300 bg-cream-50 px-8 py-8 text-center">
        <p className="text-sm font-medium tracking-wide text-ink-500">{set.title}</p>
        <p className="mt-2 font-display text-5xl text-ink-900">{pct}%</p>
        <p className="mt-1 text-ink-500">
          {correct} of {total} correct
        </p>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-2xl text-ink-900">Your coach&rsquo;s notes</h2>
        {loading && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 px-5 py-4">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent-600" />
            <p className="text-sm text-ink-700">
              {status ?? 'Reviewing your answers and writing your study plan…'}
            </p>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-600/30 bg-rose-100 px-5 py-4 text-sm text-rose-600">
            {error}
          </div>
        )}
        {report && (
          <div className="mt-4 rounded-2xl border border-cream-300 bg-cream-50 px-7 py-6 leading-relaxed whitespace-pre-wrap text-ink-700">
            {report}
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={onRetake}
          className="rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 transition hover:bg-accent-700"
        >
          Retake this set
        </button>
        <button
          onClick={onHome}
          className="rounded-full border border-cream-300 px-6 py-2.5 font-medium text-ink-700 transition hover:border-accent-600/40"
        >
          Back to home
        </button>
      </div>
    </div>
  )
}
