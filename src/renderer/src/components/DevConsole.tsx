import { useEffect, useRef, useState } from 'react'
import { useLogs } from '../logs'
import type { LogLevel } from '../../../shared/types'

const DOT: Record<LogLevel, string> = {
  info: 'bg-ink-500',
  success: 'bg-sage-600',
  error: 'bg-rose-600'
}

const TEXT: Record<LogLevel, string> = {
  info: 'text-ink-700',
  success: 'text-sage-600',
  error: 'text-rose-600'
}

export default function DevConsole(): React.JSX.Element {
  const { events, latest, clear } = useLogs()
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Cmd/Ctrl+` toggles the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [events, open])

  const errorCount = events.filter((e) => e.level === 'error').length

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-cream-300 bg-cream-50/95 backdrop-blur">
      {/* Status bar — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-1.5 text-left font-mono text-xs text-ink-700 hover:bg-cream-200/60"
      >
        <span className="font-sans font-medium text-ink-500">Status</span>
        {latest ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[latest.level]}`} />
            <span className="truncate">{latest.message}</span>
          </span>
        ) : (
          <span className="text-ink-500">idle</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-3 text-ink-500">
          {errorCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-600">
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="font-sans">{open ? 'Hide log ▾' : 'Show log ▴'}</span>
        </span>
      </button>

      {/* Expanded log */}
      {open && (
        <div className="border-t border-cream-300">
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="font-sans text-xs text-ink-500">
              Activity log · {events.length} events · ⌘` to toggle
            </span>
            <button
              onClick={clear}
              className="font-sans text-xs text-ink-500 hover:text-ink-900"
            >
              Clear
            </button>
          </div>
          <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 pb-3">
            {events.length === 0 ? (
              <p className="font-mono text-xs text-ink-500">No activity yet.</p>
            ) : (
              <table className="w-full font-mono text-xs">
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="whitespace-nowrap py-0.5 pr-3 text-ink-500">{e.time}</td>
                      <td className="py-0.5 pr-3">
                        <span className={`h-2 w-2 inline-block rounded-full ${DOT[e.level]}`} />
                      </td>
                      <td className="whitespace-nowrap py-0.5 pr-3 text-ink-500">{e.scope}</td>
                      <td className={`py-0.5 ${TEXT[e.level]}`}>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
