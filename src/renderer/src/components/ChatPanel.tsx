import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, Question } from '../../../shared/types'

interface Props {
  question: Question
  answered: boolean
}

export default function ChatPanel({ question, answered }: Props): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    const history = messages
    setMessages([...history, { role: 'user', content: text }])
    setThinking(true)
    try {
      const reply = await window.api.getHint({ question, history, message: text })
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I hit an error: ${msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`
        }
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-cream-300 bg-cream-50">
      <div className="border-b border-cream-300 px-5 py-4">
        <p className="font-display text-ink-900">Tutor</p>
        <p className="text-xs text-ink-500">
          {answered
            ? 'Ask me anything about this question.'
            : 'Ask about the topic, the options, or for a hint.'}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !thinking && (
          <p className="text-sm leading-relaxed text-ink-500">
            Try: &ldquo;What should I focus on in this vignette?&rdquo; or &ldquo;Can you remind me how
            this mechanism works?&rdquo;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'ml-auto bg-accent-600 text-cream-50'
                : 'bg-cream-200 text-ink-900'
            }`}
          >
            {m.content}
          </div>
        ))}
        {thinking && (
          <div className="max-w-[90%] rounded-2xl bg-cream-200 px-4 py-2.5 text-sm text-ink-500">
            thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-cream-300 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask for a hint…"
            className="min-w-0 flex-1 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm text-ink-900 placeholder:text-ink-500/60 focus:border-accent-600/60 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking}
            className="rounded-full bg-accent-600 px-4 py-2 text-sm font-medium text-cream-50 transition hover:bg-accent-700 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  )
}
