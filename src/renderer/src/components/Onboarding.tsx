import { useEffect, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from './icons'

interface Props {
  onDone: () => void
}

/** Ring that sweeps to `pct` just after mount, so it replays every time its slide appears. */
function DemoRing({
  pct,
  className,
  children
}: {
  pct: number
  className?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setProgress(pct))
    return () => cancelAnimationFrame(raf)
  }, [pct])
  const r = 70
  const c = 2 * Math.PI * r
  return (
    <div className={`relative ${className ?? ''}`}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--color-cream-300)" strokeWidth="8" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress / 100)}
          className={`transition-[stroke-dashoffset] duration-[1400ms] ease-out ${
            progress === 0 ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function WelcomeArt(): React.JSX.Element {
  return (
    <div className="relative">
      <DemoRing pct={100} className="h-44 w-44 text-accent-600">
        <span className="animate-[pop-in_600ms_ease-out_500ms_both] font-display text-6xl text-ink-900">
          O
        </span>
      </DemoRing>
      <span className="absolute -top-1 -right-5 h-3 w-3 animate-[float_3.2s_ease-in-out_infinite] rounded-full bg-sage-600/70" />
      <span className="absolute bottom-3 -left-7 h-2 w-2 animate-[float_2.6s_ease-in-out_0.4s_infinite] rounded-full bg-accent-600/60" />
      <span className="absolute top-12 -right-9 h-2.5 w-2.5 animate-[float_3.8s_ease-in-out_0.8s_infinite] rounded-full bg-rose-600/50" />
    </div>
  )
}

function GenerateArt(): React.JSX.Element {
  return (
    <div className="flex items-center gap-7">
      {/* the lecture PDF, drawing its text lines in */}
      <div className="w-28 animate-[pop-in_400ms_ease-out_both] rounded-xl border border-cream-300 bg-white p-3.5 shadow-sm">
        <div className="h-2 w-3/5 rounded bg-accent-600/60" />
        {[100, 80, 92, 65].map((w, i) => (
          <div
            key={i}
            style={{ width: `${w}%`, animationDelay: `${350 + i * 160}ms` }}
            className="mt-2 h-1.5 origin-left animate-[grow-x_400ms_ease-out_both] rounded bg-cream-300"
          />
        ))}
      </div>
      <ArrowRightIcon className="h-6 w-6 animate-pulse text-ink-500" />
      {/* the fanned stack of question cards it becomes */}
      <div className="relative h-32 w-36">
        <div className="absolute inset-0 -rotate-6 animate-[pop-in_400ms_ease-out_1100ms_both] rounded-xl border border-cream-300 bg-cream-50 shadow-sm" />
        <div className="absolute inset-0 rotate-3 animate-[pop-in_400ms_ease-out_1350ms_both] rounded-xl border border-cream-300 bg-cream-50 shadow-sm" />
        <div className="absolute inset-0 animate-[pop-in_400ms_ease-out_1600ms_both] rounded-xl border border-cream-300 bg-white p-3 shadow-md">
          <p className="text-left font-display text-xs text-accent-600">Q1</p>
          <div className="mt-1.5 h-1.5 w-full rounded bg-cream-300" />
          <div className="mt-1.5 h-1.5 w-4/5 rounded bg-cream-300" />
          <div className="mt-3 space-y-1.5">
            {['A', 'B', 'C'].map((l) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cream-200 text-[8px] font-semibold text-ink-700">
                  {l}
                </span>
                <div className="h-1 w-16 rounded bg-cream-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuizArt(): React.JSX.Element {
  // a keypress "answers" the demo question shortly after the slide appears
  const [picked, setPicked] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPicked(true), 1500)
    return () => clearTimeout(t)
  }, [])
  const rows = [
    { letter: 'A', bar: 'w-40' },
    { letter: 'B', bar: 'w-48' },
    { letter: 'C', bar: 'w-36' }
  ]
  return (
    <div className="relative">
      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const lit = picked && row.letter === 'B'
          return (
            <div
              key={row.letter}
              style={{ animationDelay: `${200 + i * 180}ms` }}
              className={`flex w-72 animate-[rise-in_350ms_ease-out_both] items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-500 ${
                lit ? 'border-sage-600/50 bg-sage-100' : 'border-cream-300 bg-cream-50'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-500 ${
                  lit ? 'bg-sage-600 text-cream-50' : 'bg-cream-200 text-ink-700'
                }`}
              >
                {row.letter}
              </span>
              <span className={`h-2 ${row.bar} rounded bg-cream-300`} />
              {lit && (
                <CheckIcon className="ml-auto h-4 w-4 animate-[pop-in_300ms_ease-out] text-sage-600" />
              )}
            </div>
          )
        })}
      </div>
      <kbd
        className={`absolute top-1/2 -right-12 -translate-y-1/2 animate-[pop-in_300ms_ease-out_1000ms_both] rounded-lg border border-cream-300 bg-white px-2.5 py-1.5 text-sm font-medium text-ink-700 shadow-sm transition-all duration-200 ${
          picked ? 'scale-90 shadow-none' : ''
        }`}
      >
        2
      </kbd>
      <div className="absolute -bottom-10 right-0 animate-[pop-in_400ms_ease-out_2300ms_both] rounded-2xl rounded-br-sm border border-cream-300 bg-white px-3.5 py-2 text-xs text-ink-700 shadow-sm">
        Stuck? Ask the tutor for a hint
      </div>
    </div>
  )
}

function ProgressArt(): React.JSX.Element {
  const bars = [42, 58, 50, 74, 88]
  return (
    <div className="flex items-center gap-10">
      <DemoRing pct={88} className="h-36 w-36 text-sage-600">
        <span className="animate-[pop-in_400ms_ease-out_900ms_both] font-display text-3xl text-ink-900">
          88%
        </span>
      </DemoRing>
      <div className="flex h-28 items-end gap-2">
        {bars.map((b, i) => (
          <div
            key={i}
            style={{ height: `${b}%`, animationDelay: `${300 + i * 140}ms` }}
            className={`w-4 origin-bottom animate-[grow-y_500ms_ease-out_both] rounded-t-md ${
              i === bars.length - 1 ? 'bg-sage-600' : 'bg-cream-300'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

const SLIDES: { title: string; body: string; art: () => React.JSX.Element }[] = [
  {
    title: 'Welcome to Osler',
    body: 'Turn your lecture slides into board-style practice questions, with an AI tutor at your side.',
    art: WelcomeArt
  },
  {
    title: 'Drop in a lecture',
    body: 'Upload your slides as a PDF and Osler writes USMLE-style questions from them. The quiz starts as soon as the first few are ready — the rest keep generating while you answer.',
    art: GenerateArt
  },
  {
    title: 'Answer, learn, repeat',
    body: 'Press 1–5 to answer and Enter to move on. Every question comes with an explanation, and the tutor can nudge you with hints — it knows the answer but will never spoil it.',
    art: QuizArt
  },
  {
    title: 'Watch yourself improve',
    body: 'Finish a set for your score, a personal study plan from your coach, and one-tap redo of the questions you missed. Osler tracks every attempt so you can see your topics turn green.',
    art: ProgressArt
  }
]

export default function Onboarding({ onDone }: Props): React.JSX.Element {
  const [step, setStep] = useState(0)
  const last = step === SLIDES.length - 1
  const slide = SLIDES[step]
  const Art = slide.art

  return (
    <div className="relative flex h-[calc(100vh-2rem)] flex-col items-center justify-center px-8">
      {!last && (
        <button
          onClick={onDone}
          className="absolute top-6 right-8 text-sm text-ink-500 transition-colors duration-200 hover:text-ink-900"
        >
          Skip the tour
        </button>
      )}

      {/* keyed by step so every slide replays its entrance animations */}
      <div
        key={step}
        className="flex w-full max-w-xl animate-[slide-in_350ms_ease-out] flex-col items-center text-center"
      >
        <div className="flex h-60 items-center justify-center">
          <Art />
        </div>
        <h1 className="mt-6 font-display text-4xl text-ink-900">{slide.title}</h1>
        <p className="mt-3 max-w-md leading-relaxed text-ink-500">{slide.body}</p>
      </div>

      <div className="mt-10 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            aria-label={`Go to step ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-accent-600' : 'w-2 bg-cream-400 hover:bg-ink-500/40'
            }`}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="group flex items-center gap-1.5 rounded-full border border-cream-300 px-5 py-2.5 text-sm font-medium text-ink-700 transition-all duration-200 hover:border-accent-600/40 hover:shadow-sm active:scale-95"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back
          </button>
        )}
        <button
          onClick={() => (last ? onDone() : setStep(step + 1))}
          className="group flex items-center gap-2 rounded-full bg-accent-600 px-7 py-2.5 font-medium text-cream-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/25 active:translate-y-0 active:scale-[0.97]"
        >
          {last ? 'Get started' : 'Next'}
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}
