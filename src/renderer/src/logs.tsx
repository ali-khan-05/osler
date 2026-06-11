import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { LogEvent } from '../../shared/types'

interface LogContextValue {
  events: LogEvent[]
  latest: LogEvent | null
  clear: () => void
}

const LogContext = createContext<LogContextValue>({ events: [], latest: null, clear: () => {} })

export function LogProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [events, setEvents] = useState<LogEvent[]>([])
  // Floor for clearing the view without losing the main-process buffer.
  const clearedBeforeId = useRef(0)

  useEffect(() => {
    let active = true
    window.api.getLogs().then((history) => {
      if (active) setEvents(history)
    })
    const unsubscribe = window.api.onLog((event) => {
      setEvents((prev) => {
        const next = [...prev, event]
        return next.length > 300 ? next.slice(-300) : next
      })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const visible = events.filter((e) => e.id > clearedBeforeId.current)
  const value: LogContextValue = {
    events: visible,
    latest: visible.length ? visible[visible.length - 1] : null,
    clear: () => {
      clearedBeforeId.current = events.length ? events[events.length - 1].id : 0
      setEvents((prev) => [...prev])
    }
  }

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>
}

export function useLogs(): LogContextValue {
  return useContext(LogContext)
}

/** The most recent status line, optionally filtered to one scope (e.g. "generate"). */
export function useLatestStatus(scope?: string): string | null {
  const { events } = useLogs()
  for (let i = events.length - 1; i >= 0; i--) {
    if (!scope || events[i].scope === scope) return events[i].message
  }
  return null
}
