import { useEffect, useRef, useState } from 'react'
import type { QuestionSet } from '../../../shared/types'
import {
  ArrowUpIcon,
  ChevronIcon,
  DotsIcon,
  GearIcon,
  MiniRing,
  OslerMark,
  PlusIcon,
  XIcon
} from './icons'

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

/** Current score of a set as a 0–100 percentage, from its saved answers. */
function scorePct(set: QuestionSet): number {
  const correct = set.questions.filter((q, i) => set.answers[i] === q.correctIndex).length
  return Math.round((correct / set.questions.length) * 100)
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
  // which side the move submenu flies out on; flips left when the window edge is too close
  const [flipLeft, setFlipLeft] = useState(false)
  const moveItemRef = useRef<HTMLDivElement>(null)

  const openMove = (): void => {
    const rect = moveItemRef.current?.getBoundingClientRect()
    // submenu is w-44 (176px) plus a 6px gap
    setFlipLeft(rect ? rect.right + 182 > window.innerWidth : false)
    setShowMove(true)
  }

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
        aria-label="Lecture options"
        className={`rounded-full p-1.5 text-ink-500 transition-all duration-200 hover:bg-cream-200 hover:text-ink-900 active:scale-90 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <DotsIcon className="h-5 w-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute top-9 right-0 z-20 w-52 origin-top-right animate-[pop-in_150ms_ease-out] rounded-xl border border-cream-300 bg-white p-1 shadow-lg">
            <div
              ref={moveItemRef}
              className="relative"
              onMouseEnter={openMove}
              onMouseLeave={() => setShowMove(false)}
            >
              <button
                onClick={() => (showMove ? setShowMove(false) : openMove())}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-ink-700 transition-colors duration-150 ${
                  showMove ? 'bg-cream-100' : 'hover:bg-cream-100'
                }`}
              >
                Move to another topic
                <ChevronIcon className="h-3.5 w-3.5 -rotate-90 text-ink-500" />
              </button>
              {showMove && (
                <div
                  className={`absolute top-0 z-30 ${flipLeft ? 'right-full pr-1.5' : 'left-full pl-1.5'}`}
                >
                  <div
                    className={`w-44 animate-[pop-in_150ms_ease-out] overflow-hidden rounded-xl border border-cream-300 bg-white py-1 shadow-lg ${
                      flipLeft ? 'origin-top-right' : 'origin-top-left'
                    }`}
                  >
                    <p className="px-4 pt-2 pb-1 text-xs font-medium tracking-wide text-ink-500">
                      MOVE TO
                    </p>
                    {targets.map((t) => (
                      <button
                        key={t}
                        onClick={() => move(t)}
                        className="block w-full truncate px-4 py-2 text-left text-sm text-ink-700 transition-colors duration-150 hover:bg-cream-100"
                      >
                        {t}
                      </button>
                    ))}
                    {set.topic && (
                      <button
                        onClick={() => move(null)}
                        className="block w-full px-4 py-2 text-left text-sm text-ink-500 transition-colors duration-150 hover:bg-cream-100"
                      >
                        (no topic)
                      </button>
                    )}
                    {targets.length === 0 && !set.topic && (
                      <p className="px-4 py-2 text-sm text-ink-500">
                        No topics yet — add one with ＋
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={del}
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-rose-600 transition-colors duration-150 hover:bg-rose-100"
            >
              Delete lecture
            </button>
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
  const pct = scorePct(set)
  // compare the last two recorded attempts for the trend arrow
  const attempts = set.attempts ?? []
  const prev = attempts.length >= 2 ? attempts[attempts.length - 2] : null
  const prevPct = prev ? Math.round((prev.correct / prev.total) * 100) : null
  const trend =
    finished && prevPct !== null && pct !== prevPct ? (pct > prevPct ? 'up' : 'down') : null

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
      className="group flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 first:rounded-t-[15px] last:rounded-b-[15px] hover:bg-white focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:outline-none focus-visible:ring-inset"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-lg text-ink-900 transition-colors duration-200 group-hover:text-accent-700">
          {set.title}
        </p>
        <p className="mt-0.5 text-sm text-ink-500">
          {total} questions · {new Date(set.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {finished ? (
          <span
            title={trend ? `${trend === 'up' ? 'Up' : 'Down'} from ${prevPct}% last attempt` : undefined}
            className="flex items-center gap-1 rounded-full bg-sage-100 px-3 py-1 text-sm font-medium text-sage-600 transition-colors duration-200 group-hover:bg-sage-600 group-hover:text-cream-50"
          >
            {pct}% · review
            {trend === 'up' && <ArrowUpIcon className="h-3.5 w-3.5" />}
            {trend === 'down' && (
              <ArrowUpIcon className="h-3.5 w-3.5 rotate-180 text-rose-600 transition-colors duration-200 group-hover:text-rose-100" />
            )}
          </span>
        ) : answered > 0 ? (
          <span className="rounded-full bg-cream-200 px-3 py-1 text-sm font-medium text-ink-700 transition-colors duration-200 group-hover:bg-accent-600 group-hover:text-cream-50">
            {answered}/{total} · resume
          </span>
        ) : (
          <span className="rounded-full bg-cream-200 px-3 py-1 text-sm font-medium text-ink-700 transition-colors duration-200 group-hover:bg-accent-600 group-hover:text-cream-50">
            start
          </span>
        )}
        <CardMenu set={set} topics={topics} onChanged={onChanged} />
      </div>
    </div>
  )
}

/** Lectures in one topic render as a single container with row dividers, so the group reads as one unit. */
function SetList({
  sets,
  topics,
  onOpenSet,
  onChanged
}: {
  sets: QuestionSet[]
  topics: string[]
  onOpenSet: (set: QuestionSet) => void
  onChanged: () => void
}): React.JSX.Element {
  return (
    <div className="divide-y divide-cream-200 rounded-2xl border border-cream-300 bg-cream-50 shadow-sm">
      {sets.map((set) => (
        <SetCard key={set.id} set={set} topics={topics} onOpenSet={onOpenSet} onChanged={onChanged} />
      ))}
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
        <div className="group flex items-center gap-3.5">
          <OslerMark className="h-11 w-11 shrink-0" />
          <div>
            <h1 className="font-display text-4xl text-ink-900 transition-colors duration-300 group-hover:text-accent-700">
              Osler
            </h1>
            <p className="mt-1 text-ink-500">USMLE-style practice questions from your lectures</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSettings}
            title="Settings"
            aria-label="Settings"
            className="group rounded-full border border-cream-300 bg-cream-50 p-2.5 text-ink-700 transition-all duration-200 hover:border-accent-600/40 hover:text-ink-900 hover:shadow-sm active:scale-95"
          >
            <GearIcon className="h-5 w-5 transition-transform duration-300 ease-out group-hover:rotate-45" />
          </button>
          <button
            onClick={onNewSet}
            className="group flex items-center gap-2 rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/25 active:translate-y-0 active:scale-[0.97]"
          >
            <PlusIcon className="h-4 w-4 transition-transform duration-300 ease-out group-hover:rotate-90" />
            New question set
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
            className="w-48 animate-[pop-in_150ms_ease-out] rounded-full border border-accent-600/40 bg-white px-4 py-1.5 text-sm text-ink-900 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setAddingTopic(true)}
            title="Add a topic"
            className="group flex items-center gap-1.5 rounded-full border border-cream-300 bg-cream-50 px-4 py-1.5 text-sm font-medium text-ink-700 transition-all duration-200 hover:border-accent-600/40 hover:text-ink-900 hover:shadow-sm active:scale-95"
          >
            <PlusIcon className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:rotate-90" />
            Add topic
          </button>
        )}
      </div>

      {sets.length === 0 && allTopics.length === 0 ? (
        <div className="rounded-2xl border border-cream-300 bg-cream-50 px-8 py-16 text-center">
          <p className="font-display text-xl text-ink-700">No question sets yet</p>
          <p className="mt-2 text-ink-500">
            Upload your lecture slides and Osler will write practice questions for you.
          </p>
          <button
            onClick={onNewSet}
            className="group mx-auto mt-6 flex items-center gap-2 rounded-full bg-accent-600 px-6 py-2.5 font-medium text-cream-50 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/25 active:translate-y-0 active:scale-[0.97]"
          >
            <PlusIcon className="h-4 w-4 transition-transform duration-300 ease-out group-hover:rotate-90" />
            New question set
          </button>
        </div>
      ) : sectionNames.length === 0 ? (
        // no topics yet — plain list
        <SetList sets={sets} topics={allTopics} onOpenSet={onOpenSet} onChanged={onChanged} />
      ) : (
        <div className="space-y-6">
          {sectionNames.map((topic) => {
            const topicSets = groups.get(topic) ?? (topic === UNFILED ? unfiled : [])
            const isCollapsed = collapsed.includes(topic)
            const isTarget = dragOver === topic
            if (topic === UNFILED && topicSets.length === 0) return null
            // topic mastery: average score across finished sets
            const finishedSets = topicSets.filter(
              (s) => s.questions.length > 0 && s.answers.every((a) => a !== null)
            )
            const mastery =
              finishedSets.length > 0
                ? Math.round(
                    finishedSets.reduce((sum, s) => sum + scorePct(s), 0) / finishedSets.length
                  )
                : null
            const masteryTone =
              mastery === null
                ? ''
                : mastery >= 80
                  ? 'text-sage-600'
                  : mastery >= 50
                    ? 'text-accent-600'
                    : 'text-rose-600'
            return (
              <section
                key={topic}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(topic)
                }}
                onDragLeave={() => setDragOver((cur) => (cur === topic ? null : cur))}
                onDrop={(e) => dropOn(e, topic)}
                className={`rounded-2xl transition-all duration-200 ${
                  isTarget ? 'bg-accent-600/5 ring-2 ring-accent-600/40' : ''
                }`}
              >
                <div className="group/topic mb-2.5 flex items-center gap-2">
                  <button
                    onClick={() => toggle(topic)}
                    className="flex items-center gap-2 rounded-lg text-left"
                    aria-expanded={!isCollapsed}
                  >
                    <ChevronIcon
                      className={`h-4 w-4 text-ink-500 transition-transform duration-200 ease-out ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                    <h2 className="font-display text-xl text-ink-900">{topic}</h2>
                    <span className="rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-medium text-ink-500">
                      {topicSets.length}
                    </span>
                    {mastery !== null && (
                      <span
                        title={`Average score across ${finishedSets.length} finished ${
                          finishedSets.length === 1 ? 'set' : 'sets'
                        }`}
                        className={`flex items-center gap-1 ${masteryTone}`}
                      >
                        <MiniRing pct={mastery} className="h-4 w-4" />
                        <span className="text-xs font-medium">{mastery}%</span>
                      </span>
                    )}
                  </button>
                  {topic !== UNFILED && topicSets.length === 0 && (
                    <button
                      onClick={() => removeTopic(topic)}
                      title="Remove this empty topic"
                      aria-label={`Remove topic ${topic}`}
                      className="rounded-full p-1 text-ink-500 opacity-0 transition-all duration-200 group-hover/topic:opacity-100 hover:text-rose-600 active:scale-90"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="animate-[rise-in_200ms_ease-out]">
                    {topicSets.length > 0 ? (
                      <SetList
                        sets={topicSets}
                        topics={allTopics}
                        onOpenSet={onOpenSet}
                        onChanged={onChanged}
                      />
                    ) : (
                      <div
                        className={`rounded-2xl border border-dashed px-6 py-6 text-center text-sm transition-colors duration-200 ${
                          isTarget ? 'border-accent-600/50 text-accent-700' : 'border-cream-400 text-ink-500'
                        }`}
                      >
                        Drag lectures here
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
