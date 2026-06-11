import { useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import ChatPanel from './ChatPanel'

interface Props {
  set: QuestionSet
  onFinished: (set: QuestionSet) => void
  onExit: () => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export default function Quiz({ set, onFinished, onExit }: Props): React.JSX.Element {
  const firstUnanswered = set.answers.findIndex((a) => a === null)
  const [index, setIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered)
  const [answers, setAnswers] = useState<(number | null)[]>(set.answers)

  const question = set.questions[index]
  const chosen = answers[index]
  const answered = chosen !== null
  const total = set.questions.length
  const answeredCount = answers.filter((a) => a !== null).length

  const choose = (optionIndex: number): void => {
    if (answered) return
    const next = [...answers]
    next[index] = optionIndex
    setAnswers(next)
    window.api.saveAnswers(set.id, next)
  }

  const goNext = (): void => {
    if (index < total - 1) {
      setIndex(index + 1)
    } else {
      onFinished({ ...set, answers })
    }
  }

  const optionStyle = (i: number): string => {
    const base =
      'flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition '
    if (!answered) {
      return base + 'border-cream-300 bg-cream-50 hover:border-accent-600/50 hover:bg-white cursor-pointer'
    }
    if (i === question.correctIndex) {
      return base + 'border-sage-600/50 bg-sage-100'
    }
    if (i === chosen) {
      return base + 'border-rose-600/40 bg-rose-100'
    }
    return base + 'border-cream-300 bg-cream-50 opacity-60'
  }

  return (
    // leave 2rem at the bottom for the fixed status bar
    <div className="flex h-[calc(100vh-2rem)]">
      {/* Main question area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-cream-300 px-8 py-4">
          <button onClick={onExit} className="text-sm text-ink-500 hover:text-ink-900">
            ← Save & exit
          </button>
          <p className="font-display text-ink-700">{set.title}</p>
          <p className="text-sm text-ink-500">
            {answeredCount}/{total} answered
          </p>
        </header>

        {/* progress bar */}
        <div className="h-1 w-full bg-cream-200">
          <div
            className="h-1 bg-accent-600 transition-all"
            style={{ width: `${(answeredCount / total) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-sm font-medium tracking-wide text-accent-600">
              QUESTION {index + 1} OF {total}
            </p>
            <p className="font-display text-lg leading-relaxed text-ink-900 whitespace-pre-wrap">
              {question.stem}
            </p>

            <div className="mt-8 space-y-3">
              {question.options.map((option, i) => (
                <button key={i} onClick={() => choose(i)} className={optionStyle(i)} disabled={answered}>
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      answered && i === question.correctIndex
                        ? 'bg-sage-600 text-cream-50'
                        : answered && i === chosen
                          ? 'bg-rose-600 text-cream-50'
                          : 'bg-cream-200 text-ink-700'
                    }`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="leading-relaxed">{option}</span>
                </button>
              ))}
            </div>

            {answered && (
              <div className="mt-8 rounded-2xl border border-cream-300 bg-cream-50 px-6 py-5">
                <p className="mb-2 font-medium">
                  {chosen === question.correctIndex ? (
                    <span className="text-sage-600">Correct</span>
                  ) : (
                    <span className="text-rose-600">
                      Incorrect — the answer is {LETTERS[question.correctIndex]}
                    </span>
                  )}
                </p>
                <p className="leading-relaxed text-ink-700 whitespace-pre-wrap">{question.explanation}</p>
                <p className="mt-3 text-xs font-medium tracking-wide text-ink-500">
                  TOPIC: {question.topic.toUpperCase()}
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-cream-300 px-8 py-4">
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="rounded-full border border-cream-300 px-5 py-2 text-sm font-medium text-ink-700 transition hover:border-accent-600/40 disabled:opacity-30"
          >
            ← Previous
          </button>
          <button
            onClick={goNext}
            disabled={!answered}
            className="rounded-full bg-accent-600 px-6 py-2 text-sm font-medium text-cream-50 transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {index === total - 1 ? 'Finish & get coaching' : 'Next →'}
          </button>
        </footer>
      </div>

      {/* Hint chat sidebar */}
      <ChatPanel key={index} question={question} answered={answered} />
    </div>
  )
}
