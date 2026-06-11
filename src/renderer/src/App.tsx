import { useEffect, useState } from 'react'
import type { QuestionSet } from '../../shared/types'
import Home from './components/Home'
import NewSet from './components/NewSet'
import Quiz from './components/Quiz'
import Results from './components/Results'
import Settings from './components/Settings'
import DevConsole from './components/DevConsole'
import { LogProvider } from './logs'

type View = 'home' | 'new' | 'quiz' | 'results' | 'settings'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('home')
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null)
  const [generating, setGenerating] = useState(false)

  const refreshSets = async (): Promise<void> => {
    setSets(await window.api.listSets())
  }

  useEffect(() => {
    refreshSets()
  }, [])

  const openSet = (set: QuestionSet): void => {
    setActiveSet(set)
    setGenerating(false)
    const finished = set.answers.every((a) => a !== null)
    setView(finished ? 'results' : 'quiz')
  }

  const handleCreated = (set: QuestionSet, stillGenerating: boolean): void => {
    refreshSets()
    setActiveSet(set)
    setGenerating(stillGenerating)
    setView('quiz')
  }

  const handleFinished = (set: QuestionSet): void => {
    setActiveSet(set)
    refreshSets()
    setView('results')
  }

  const handleRetake = async (): Promise<void> => {
    if (!activeSet) return
    const fresh = await window.api.resetSet(activeSet.id)
    if (fresh) {
      setActiveSet(fresh)
      refreshSets()
      setView('quiz')
    }
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
            key={activeSet.id}
            set={activeSet}
            generating={generating}
            onFinished={handleFinished}
            onExit={goHome}
          />
        )}
        {view === 'results' && activeSet && (
          <Results set={activeSet} onRetake={handleRetake} onHome={goHome} />
        )}
      </div>
      <DevConsole />
    </LogProvider>
  )
}
