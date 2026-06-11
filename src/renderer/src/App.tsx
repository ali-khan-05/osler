import { useEffect, useState } from 'react'
import type { QuestionSet } from '../../shared/types'
import Home from './components/Home'
import NewSet from './components/NewSet'
import Onboarding from './components/Onboarding'
import Quiz from './components/Quiz'
import Results from './components/Results'
import Settings from './components/Settings'
import DevConsole from './components/DevConsole'
import { LogProvider } from './logs'

type View = 'onboarding' | 'home' | 'new' | 'quiz' | 'results' | 'settings'

const ONBOARDED_KEY = 'osler-onboarded'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>(() =>
    localStorage.getItem(ONBOARDED_KEY) ? 'home' : 'onboarding'
  )
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null)
  const [generating, setGenerating] = useState(false)
  /** When set, the quiz runs only these question indices (redo-wrong mode) */
  const [quizIndices, setQuizIndices] = useState<number[] | null>(null)
  /** Bumped on every entry into the quiz so the Quiz component remounts fresh */
  const [quizRun, setQuizRun] = useState(0)

  const refreshSets = async (): Promise<void> => {
    setSets(await window.api.listSets())
  }

  useEffect(() => {
    refreshSets()
  }, [])

  const openSet = (set: QuestionSet): void => {
    setActiveSet(set)
    setGenerating(false)
    setQuizIndices(null)
    setQuizRun((n) => n + 1)
    const finished = set.answers.every((a) => a !== null)
    setView(finished ? 'results' : 'quiz')
  }

  const handleCreated = (set: QuestionSet, stillGenerating: boolean): void => {
    refreshSets()
    setActiveSet(set)
    setGenerating(stillGenerating)
    setQuizIndices(null)
    setQuizRun((n) => n + 1)
    setView('quiz')
  }

  const handleFinished = async (set: QuestionSet): Promise<void> => {
    setActiveSet(set)
    setView('results')
    // snapshot this run into the attempt history, then pick up the stored set
    const updated = await window.api.recordAttempt(set.id)
    if (updated) setActiveSet(updated)
    refreshSets()
  }

  const handleRetake = async (): Promise<void> => {
    if (!activeSet) return
    const fresh = await window.api.resetSet(activeSet.id)
    if (fresh) {
      setActiveSet(fresh)
      refreshSets()
      setQuizIndices(null)
      setQuizRun((n) => n + 1)
      setView('quiz')
    }
  }

  const handleRedoWrong = (wrongIndices: number[]): void => {
    if (!activeSet) return
    const answers = activeSet.answers.map((a, i) => (wrongIndices.includes(i) ? null : a))
    window.api.saveAnswers(activeSet.id, answers)
    setActiveSet({ ...activeSet, answers, coachReport: null })
    setQuizIndices(wrongIndices)
    setQuizRun((n) => n + 1)
    setView('quiz')
  }

  const goHome = (): void => {
    setActiveSet(null)
    refreshSets()
    setView('home')
  }

  return (
    <LogProvider>
      {/* pb-8 keeps content clear of the fixed status bar */}
      <div className="min-h-screen pb-8">
        {view === 'onboarding' && (
          <Onboarding
            onDone={() => {
              localStorage.setItem(ONBOARDED_KEY, '1')
              setView('home')
            }}
          />
        )}
        {view === 'home' && (
          <Home
            sets={sets}
            onOpenSet={openSet}
            onNewSet={() => setView('new')}
            onSettings={() => setView('settings')}
            onChanged={refreshSets}
          />
        )}
        {view === 'settings' && <Settings onBack={goHome} />}
        {view === 'new' && <NewSet onCreated={handleCreated} onCancel={goHome} />}
        {view === 'quiz' && activeSet && (
          <Quiz
            key={`${activeSet.id}:${quizRun}`}
            set={activeSet}
            generating={generating}
            indices={quizIndices ?? undefined}
            onFinished={handleFinished}
            onExit={goHome}
          />
        )}
        {view === 'results' && activeSet && (
          <Results
            set={activeSet}
            onRetake={handleRetake}
            onRedoWrong={handleRedoWrong}
            onHome={goHome}
          />
        )}
      </div>
      <DevConsole />
    </LogProvider>
  )
}
