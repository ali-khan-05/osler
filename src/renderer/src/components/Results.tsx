import { useEffect, useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import { useLatestStatus } from '../logs'

interface Props {
  set: QuestionSet
  onRetake: () => void
  onRedoWrong: (wrongIndices: number[]) => void
  onHome: () => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export default function Results({ set, onRetake, onRedoWrong, onHome }: Props): React.JSX.Element {
  const [report, setReport] = useState<string | null>(set.coachReport)
  const [loading, setLoading] = useState(!set.coachReport)
  const [error, setError] = useState<string | null>(null)
  // a freshly written report starts open; one you've already seen starts collapsed
  const [showCoach, setShowCoach] = useState(!set.coachReport)
  const [showReview, setShowReview] = useState(false)
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null)
  const status = useLatestStatus('coach')

  const total = set.questions.length
  const correct = set.questions.filter((q, i) => set.answers[i] === q.correctIndex).length
  const pct = Math.round((correct / total) * 100)
  const wrongIndices = set.questions
    .map((q, i) => (set.answers[i] === q.correctIndex ? -1 : i))
    .filter((i) => i !== -1)

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

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {wrongIndices.length > 0 && (
          <button
            onClick={() => onRedoWrong(wrongIndices)}
            className="rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 transition hover:bg-accent-700"
          >
            Redo the {wrongIndices.length} you missed
          </button>
        )}
        <button
          onClick={onRetake}
          className={
            wrongIndices.length > 0
              ? 'rounded-full border border-cream-300 px-6 py-2.5 font-medium text-ink-700 transition hover:border-accent-600/40'
              : 'rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 transition hover:bg-accent-700'
          }
        >
          Retake the whole set
        </button>
        <button
          onClick={onHome}
          className="rounded-full border border-cream-300 px-6 py-2.5 font-medium text-ink-700 transition hover:border-accent-600/40"
        >
          Back to home
        </button>
      </div>

      <div className="mt-10">
        <button
          onClick={() => setShowCoach((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="font-display text-2xl text-ink-900">Your coach&rsquo;s notes</h2>
          {report && (
            <span className="text-sm font-medium text-accent-600">
              {showCoach ? 'Hide ▴' : 'Show ▾'}
            </span>
          )}
        </button>
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
        {report && showCoach && (
          <div className="mt-4 rounded-2xl border border-cream-300 bg-cream-50 px-7 py-6 leading-relaxed whitespace-pre-wrap text-ink-700">
            {report}
          </div>
        )}
      </div>

      <div className="mt-10">
        <button
          onClick={() => setShowReview((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h2 className="font-display text-2xl text-ink-900">Review your answers</h2>
          <span className="text-sm font-medium text-accent-600">
            {showReview ? 'Hide ▴' : 'Show ▾'}
          </span>
        </button>
        {showReview && (
          <div className="mt-4 space-y-2">
            {set.questions.map((q, i) => {
              const userAnswer = set.answers[i]
              const isCorrect = userAnswer === q.correctIndex
              const isOpen = expandedQuestion === i
              return (
                <div key={i} className="rounded-2xl border border-cream-300 bg-cream-50">
                  <button
                    onClick={() => setExpandedQuestion(isOpen ? null : i)}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-cream-50 ${
                        isCorrect ? 'bg-sage-600' : 'bg-rose-600'
                      }`}
                    >
                      {isCorrect ? '✓' : '✗'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-700">
                        Question {i + 1} · {q.topic}
                      </span>
                      {!isOpen && (
                        <span className="mt-0.5 block truncate text-sm text-ink-500">{q.stem}</span>
                      )}
                    </span>
                    <span className="mt-0.5 shrink-0 text-sm text-ink-500">{isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-cream-300 px-5 py-4">
                      <p className="font-display leading-relaxed whitespace-pre-wrap text-ink-900">
                        {q.stem}
                      </p>
                      <div className="mt-4 space-y-2">
                        {q.options.map((option, oi) => (
                          <div
                            key={oi}
                            className={`flex items-start gap-3 rounded-xl border px-4 py-2.5 text-sm ${
                              oi === q.correctIndex
                                ? 'border-sage-600/50 bg-sage-100'
                                : oi === userAnswer
                                  ? 'border-rose-600/40 bg-rose-100'
                                  : 'border-cream-300 bg-white/60'
                            }`}
                          >
                            <span className="font-semibold">{LETTERS[oi]}</span>
                            <span className="leading-relaxed">{option}</span>
                            {oi === userAnswer && (
                              <span className="ml-auto shrink-0 text-xs font-medium text-ink-500">
                                your answer
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-700">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
