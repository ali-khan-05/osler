import { useEffect, useMemo, useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import { useLatestStatus } from '../logs'
import { ArrowLeftIcon, CheckIcon, ChevronIcon, XIcon } from './icons'

interface Props {
  set: QuestionSet
  onRetake: () => void
  onRedoWrong: (wrongIndices: number[]) => void
  onHome: () => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E']

const CONFETTI_COLORS = ['#6f7d5c', '#a8653a', '#a85454', '#d8cdb2', '#8f5530']

/** One-shot CSS confetti burst over the score card for 90%+ finishes. */
function Confetti(): React.JSX.Element {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 500,
        duration: 1600 + Math.random() * 1400,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        drift: (Math.random() - 0.5) * 140,
        spin: 360 + Math.random() * 540,
        size: 5 + Math.random() * 5
      })),
    []
  )
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      aria-hidden="true"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-[1px]"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.45,
              backgroundColor: p.color,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
              animation: `confetti-fall ${p.duration}ms ease-in ${p.delay}ms both`
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

function verdict(pct: number): string {
  if (pct >= 90) return 'Outstanding'
  if (pct >= 80) return 'Excellent work'
  if (pct >= 70) return 'Solid effort'
  if (pct >= 50) return 'Getting there'
  return 'Keep at it — review below'
}

/** Animated score ring: the arc sweeps in and the number counts up on mount. */
function ScoreRing({
  pct,
  correct,
  total
}: {
  pct: number
  correct: number
  total: number
}): React.JSX.Element {
  const [progress, setProgress] = useState(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(pct)
      setDisplay(pct)
      return undefined
    }
    const sweep = requestAnimationFrame(() => setProgress(pct))
    const start = performance.now()
    const duration = 900
    let raf: number
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * pct))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(sweep)
      cancelAnimationFrame(raf)
    }
  }, [pct])

  const radius = 70
  const circumference = 2 * Math.PI * radius
  const tone = pct >= 80 ? 'text-sage-600' : pct >= 50 ? 'text-accent-600' : 'text-rose-600'

  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="var(--color-cream-300)"
          strokeWidth="10"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          className={`${tone} transition-[stroke-dashoffset] duration-1000 ease-out ${
            progress === 0 ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl text-ink-900">{display}%</span>
        <span className="mt-1 text-sm text-ink-500">
          {correct} of {total}
        </span>
      </div>
    </div>
  )
}

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

  // attempt history: compare with the run before this one
  const attempts = set.attempts ?? []
  const prev = attempts.length >= 2 ? attempts[attempts.length - 2] : null
  const prevPct = prev ? Math.round((prev.correct / prev.total) * 100) : null

  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (pct < 90) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    setCelebrate(true)
    const timer = setTimeout(() => setCelebrate(false), 3500)
    return () => clearTimeout(timer)
  }, [pct])

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
      <button
        onClick={onHome}
        className="group mb-8 flex items-center gap-1.5 text-sm text-ink-500 transition-colors duration-200 hover:text-ink-900"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Home
      </button>

      <div className="relative animate-[rise-in_300ms_ease-out] rounded-2xl border border-cream-300 bg-cream-50 px-8 py-10 text-center">
        {celebrate && <Confetti />}
        <p className="text-sm font-medium tracking-wide text-ink-500">{set.title}</p>
        <div className="mt-6 flex justify-center">
          <ScoreRing pct={pct} correct={correct} total={total} />
        </div>
        <p className="mt-5 font-display text-2xl text-ink-900">{verdict(pct)}</p>
        {prevPct !== null && (
          <p
            className={`mt-1.5 text-sm font-medium ${
              pct > prevPct ? 'text-sage-600' : 'text-ink-500'
            }`}
          >
            {pct > prevPct
              ? `Up from ${prevPct}% last attempt`
              : pct < prevPct
                ? `Down from ${prevPct}% last attempt`
                : `Same as last attempt — ${prevPct}%`}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-1.5" aria-hidden="true">
          {set.questions.map((q, i) => (
            <span
              key={i}
              title={`Question ${i + 1} · ${set.answers[i] === q.correctIndex ? 'correct' : 'missed'}`}
              style={{ animationDelay: `${300 + i * 50}ms` }}
              className={`h-2.5 w-2.5 animate-[pop-in_300ms_ease-out_both] rounded-full ${
                set.answers[i] === q.correctIndex ? 'bg-sage-600' : 'bg-rose-600'
              }`}
            />
          ))}
        </div>
        {attempts.length >= 2 && (
          <div className="mt-6">
            <p className="text-xs font-medium tracking-widest text-ink-500">ATTEMPTS</p>
            <div className="mt-2 flex h-10 items-end justify-center gap-1">
              {attempts.slice(-8).map((a, i, shown) => {
                const aPct = Math.round((a.correct / a.total) * 100)
                const latest = i === shown.length - 1
                return (
                  <div
                    key={`${a.date}-${i}`}
                    title={`${aPct}% · ${new Date(a.date).toLocaleDateString()}`}
                    style={{ height: `${Math.max(10, aPct)}%` }}
                    className={`w-3 rounded-t-sm transition-colors ${
                      latest ? 'bg-accent-600' : 'bg-cream-300 hover:bg-cream-400'
                    }`}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {wrongIndices.length > 0 && (
          <button
            onClick={() => onRedoWrong(wrongIndices)}
            className="rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/25 active:translate-y-0 active:scale-[0.97]"
          >
            Redo the {wrongIndices.length} you missed
          </button>
        )}
        <button
          onClick={onRetake}
          className={
            wrongIndices.length > 0
              ? 'rounded-full border border-cream-300 px-6 py-2.5 font-medium text-ink-700 transition-all duration-200 hover:border-accent-600/40 hover:shadow-sm active:scale-95'
              : 'rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/25 active:translate-y-0 active:scale-[0.97]'
          }
        >
          Retake the whole set
        </button>
        <button
          onClick={onHome}
          className="rounded-full border border-cream-300 px-6 py-2.5 font-medium text-ink-700 transition-all duration-200 hover:border-accent-600/40 hover:shadow-sm active:scale-95"
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
            <span className="flex items-center gap-1 text-sm font-medium text-accent-600">
              {showCoach ? 'Hide' : 'Show'}
              <ChevronIcon
                className={`h-3.5 w-3.5 transition-transform duration-200 ${showCoach ? 'rotate-180' : ''}`}
              />
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
          <div className="mt-4 animate-[rise-in_200ms_ease-out] rounded-2xl border border-cream-300 bg-cream-50 px-7 py-6 leading-relaxed whitespace-pre-wrap text-ink-700">
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
          <span className="flex items-center gap-1 text-sm font-medium text-accent-600">
            {showReview ? 'Hide' : 'Show'}
            <ChevronIcon
              className={`h-3.5 w-3.5 transition-transform duration-200 ${showReview ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
        {showReview && (
          <div className="mt-4 animate-[rise-in_200ms_ease-out] space-y-2">
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
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-cream-50 ${
                        isCorrect ? 'bg-sage-600' : 'bg-rose-600'
                      }`}
                    >
                      {isCorrect ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-700">
                        Question {i + 1} · {q.topic}
                      </span>
                      {!isOpen && (
                        <span className="mt-0.5 block truncate text-sm text-ink-500">{q.stem}</span>
                      )}
                    </span>
                    <ChevronIcon
                      className={`mt-1 h-4 w-4 shrink-0 text-ink-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="animate-[rise-in_200ms_ease-out] border-t border-cream-300 px-5 py-4">
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
