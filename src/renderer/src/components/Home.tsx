import type { QuestionSet } from '../../../shared/types'

interface Props {
  sets: QuestionSet[]
  onOpenSet: (set: QuestionSet) => void
  onNewSet: () => void
  onSettings: () => void
  onChanged: () => void
}

export default function Home({ sets, onOpenSet, onNewSet, onSettings, onChanged }: Props): React.JSX.Element {
  const handleDelete = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation()
    await window.api.deleteSet(id)
    onChanged()
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl text-ink-900">Osler</h1>
          <p className="mt-1 text-ink-500">USMLE-style practice questions from your lectures</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSettings}
            className="rounded-full border border-cream-300 bg-cream-50 px-5 py-2.5 font-medium text-ink-700 transition hover:border-accent-600/40 hover:text-ink-900"
          >
            Settings
          </button>
          <button
            onClick={onNewSet}
            className="rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 transition hover:bg-accent-700"
          >
            + New question set
          </button>
        </div>
      </header>

      {sets.length === 0 ? (
        <div className="rounded-2xl border border-cream-300 bg-cream-50 px-8 py-16 text-center">
          <p className="font-display text-xl text-ink-700">No question sets yet</p>
          <p className="mt-2 text-ink-500">
            Upload your lecture slides and Osler will write practice questions for you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((set) => {
            const answered = set.answers.filter((a) => a !== null).length
            const total = set.questions.length
            const finished = answered === total
            const correct = set.questions.filter((q, i) => set.answers[i] === q.correctIndex).length
            return (
              <button
                key={set.id}
                onClick={() => onOpenSet(set)}
                className="group flex w-full items-center justify-between rounded-2xl border border-cream-300 bg-cream-50 px-6 py-5 text-left transition hover:border-accent-600/40 hover:bg-white"
              >
                <div>
                  <p className="font-display text-lg text-ink-900">{set.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {total} questions · {new Date(set.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {finished ? (
                    <span className="rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-sage-600">
                      {Math.round((correct / total) * 100)}% · review
                    </span>
                  ) : answered > 0 ? (
                    <span className="rounded-full bg-cream-200 px-3 py-1 text-sm font-medium text-ink-700">
                      {answered}/{total} · resume
                    </span>
                  ) : (
                    <span className="rounded-full bg-cream-200 px-3 py-1 text-sm font-medium text-ink-700">
                      start
                    </span>
                  )}
                  <span
                    role="button"
                    onClick={(e) => handleDelete(e, set.id)}
                    className="rounded-full px-2 py-1 text-sm text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                    title="Delete set"
                  >
                    ✕
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
