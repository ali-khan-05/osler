import { useEffect, useState } from 'react'
import type { QuestionSet } from '../../../shared/types'

interface Props {
  sets: QuestionSet[]
  onOpenSet: (set: QuestionSet) => void
  onNewSet: () => void
  onSettings: () => void
  onChanged: () => void
}

const UNFILED = 'Unfiled'
const COLLAPSED_KEY = 'osler-collapsed-topics'

function loadCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Hover "⋯" menu on each lecture card: move to another topic, or delete. */
function CardMenu({
  set,
  topics,
  onChanged
}: {
  set: QuestionSet
  topics: string[]
  onChanged: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [showMove, setShowMove] = useState(false)

  const close = (): void => {
    setOpen(false)
    setShowMove(false)
  }

  const move = async (topic: string | null): Promise<void> => {
    close()
    await window.api.setTopic(set.id, topic)
    onChanged()
  }

  const del = async (): Promise<void> => {
    close()
    await window.api.deleteSet(set.id)
    onChanged()
  }

  const targets = topics.filter((t) => t !== set.topic)

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => (open ? close() : setOpen(true))}
        title="Options"
        className={`rounded-full px-2.5 py-1 text-sm font-semibold tracking-wider text-ink-500 transition hover:bg-cream-200 hover:text-ink-900 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute top-9 right-0 z-20 w-52 overflow-hidden rounded-xl border border-cream-300 bg-white py-1 shadow-lg">
            {!showMove ? (
              <>
                <button
                  onClick={() => setShowMove(true)}
                  className="block w-full px-4 py-2.5 text-left text-sm text-ink-700 transition hover:bg-cream-100"
                >
                  Move to another topic ▸
                </button>
                <button
                  onClick={del}
                  className="block w-full px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-100"
                >
                  Delete lecture
                </button>
              </>
            ) : (
              <>
                <p className="px-4 pt-2 pb-1 text-xs font-medium tracking-wide text-ink-500">
                  MOVE TO
                </p>
                {targets.map((t) => (
                  <button
                    key={t}
                    onClick={() => move(t)}
                    className="block w-full truncate px-4 py-2 text-left text-sm text-ink-700 transition hover:bg-cream-100"
                  >
                    {t}
                  </button>
                ))}
                {set.topic && (
                  <button
                    onClick={() => move(null)}
                    className="block w-full px-4 py-2 text-left text-sm text-ink-500 transition hover:bg-cream-100"
                  >
                    (no topic)
                  </button>
                )}
                {targets.length === 0 && !set.topic && (
                  <p className="px-4 py-2 text-sm text-ink-500">No topics yet — add one with ＋</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SetCard({
  set,
  topics,
  onOpenSet,
  onChanged
}: {
  set: QuestionSet
  topics: string[]
  onOpenSet: (set: QuestionSet) => void
  onChanged: () => void
}): React.JSX.Element {
  const answered = set.answers.filter((a) => a !== null).length
  const total = set.questions.length
  const finished = answered === total
  const correct = set.questions.filter((q, i) => set.answers[i] === q.correctIndex).length

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', set.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpenSet(set)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpenSet(set)
      }}
      className="group flex w-full cursor-pointer items-center justify-between rounded-2xl border border-cream-300 bg-cream-50 px-6 py-5 text-left transition hover:border-accent-600/40 hover:bg-white"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-lg text-ink-900">{set.title}</p>
        <p className="mt-0.5 text-sm text-ink-500">
          {total} questions · {new Date(set.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
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
        <CardMenu set={set} topics={topics} onChanged={onChanged} />
      </div>
    </div>
  )
}

export default function Home({
  sets,
  onOpenSet,
  onNewSet,
  onSettings,
  onChanged
}: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<string[]>(loadCollapsed)
  const [storedTopics, setStoredTopics] = useState<string[]>([])
  const [addingTopic, setAddingTopic] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)

  useEffect(() => {
    window.api.listTopics().then(setStoredTopics)
  }, [])

  const toggle = (topic: string): void => {
    const next = collapsed.includes(topic)
      ? collapsed.filter((t) => t !== topic)
      : [...collapsed, topic]
    setCollapsed(next)
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
  }

  const addTopic = async (): Promise<void> => {
    const name = newTopicName.trim()
    setAddingTopic(false)
    setNewTopicName('')
    if (name) setStoredTopics(await window.api.addTopic(name))
  }

  const removeTopic = async (name: string): Promise<void> => {
    setStoredTopics(await window.api.removeTopic(name))
    onChanged()
  }

  const dropOn = async (e: React.DragEvent, topic: string): Promise<void> => {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    await window.api.setTopic(id, topic === UNFILED ? null : topic)
    onChanged()
  }

  // Every stored topic gets a section (even when empty); set-derived topics
  // are merged in so nothing ever disappears from view.
  const groups = new Map<string, QuestionSet[]>()
  for (const set of sets) {
    const key = set.topic?.trim() || UNFILED
    groups.set(key, [...(groups.get(key) ?? []), set])
  }
  const allTopics = [...new Set([...storedTopics, ...groups.keys()])]
    .filter((t) => t !== UNFILED)
    .sort((a, b) => a.localeCompare(b))
  const unfiled = groups.get(UNFILED) ?? []
  const sectionNames = allTopics.length > 0 ? [...allTopics, UNFILED] : []

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

      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-medium tracking-widest text-ink-500">YOUR LECTURES</p>
        {addingTopic ? (
          <input
            autoFocus
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTopic()
              if (e.key === 'Escape') {
                setAddingTopic(false)
                setNewTopicName('')
              }
            }}
            onBlur={addTopic}
            placeholder="Topic name…"
            className="w-48 rounded-full border border-accent-600/40 bg-white px-4 py-1.5 text-sm text-ink-900 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setAddingTopic(true)}
            title="Add a topic"
            className="flex items-center gap-1.5 rounded-full border border-cream-300 bg-cream-50 px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:border-accent-600/40 hover:text-ink-900"
          >
            <span className="text-base leading-none">＋</span> Add topic
          </button>
        )}
      </div>

      {sets.length === 0 && allTopics.length === 0 ? (
        <div className="rounded-2xl border border-cream-300 bg-cream-50 px-8 py-16 text-center">
          <p className="font-display text-xl text-ink-700">No question sets yet</p>
          <p className="mt-2 text-ink-500">
            Upload your lecture slides and Osler will write practice questions for you.
          </p>
        </div>
      ) : sectionNames.length === 0 ? (
        // no topics yet — plain list
        <div className="space-y-3">
          {sets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              topics={allTopics}
              onOpenSet={onOpenSet}
              onChanged={onChanged}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {sectionNames.map((topic) => {
            const topicSets = groups.get(topic) ?? (topic === UNFILED ? unfiled : [])
            const isCollapsed = collapsed.includes(topic)
            const isTarget = dragOver === topic
            if (topic === UNFILED && topicSets.length === 0) return null
            return (
              <section
                key={topic}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(topic)
                }}
                onDragLeave={() => setDragOver((cur) => (cur === topic ? null : cur))}
                onDrop={(e) => dropOn(e, topic)}
                className={`rounded-2xl transition ${
                  isTarget ? 'bg-accent-600/5 ring-2 ring-accent-600/40' : ''
                }`}
              >
                <div className="group/topic mb-3 flex items-center gap-2.5">
                  <button onClick={() => toggle(topic)} className="flex items-center gap-2.5 text-left">
                    <span className="text-sm text-ink-500">{isCollapsed ? '▸' : '▾'}</span>
                    <h2 className="font-display text-xl text-ink-900">{topic}</h2>
                    <span className="rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-medium text-ink-500">
                      {topicSets.length}
                    </span>
                  </button>
                  {topic !== UNFILED && topicSets.length === 0 && (
                    <button
                      onClick={() => removeTopic(topic)}
                      title="Remove this empty topic"
                      className="rounded-full px-2 py-0.5 text-sm text-ink-500 opacity-0 transition group-hover/topic:opacity-100 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {!isCollapsed &&
                  (topicSets.length > 0 ? (
                    <div className="space-y-3">
                      {topicSets.map((set) => (
                        <SetCard
                          key={set.id}
                          set={set}
                          topics={allTopics}
                          onOpenSet={onOpenSet}
                          onChanged={onChanged}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-cream-400 px-6 py-6 text-center text-sm text-ink-500">
                      Drag lectures here
                    </div>
                  ))}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
