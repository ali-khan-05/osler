import fs from 'fs'
import { extname, basename } from 'path'
import { effectiveModel, effectiveOpenRouterKey } from './settings'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

export type ORContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

export interface ORMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ORContentPart[]
}

export interface ORLecture {
  part: ORContentPart
  /** PDFs need the file-parser plugin so text-only models can read them */
  isPdf: boolean
}

export function fileToOpenRouterPart(filePath: string): ORLecture {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.pdf') {
    return {
      part: {
        type: 'file',
        file: {
          filename: basename(filePath),
          file_data: `data:application/pdf;base64,${fs.readFileSync(filePath).toString('base64')}`
        }
      },
      isPdf: true
    }
  }
  if (ext in IMAGE_TYPES) {
    return {
      part: {
        type: 'image_url',
        image_url: {
          url: `data:${IMAGE_TYPES[ext]};base64,${fs.readFileSync(filePath).toString('base64')}`
        }
      },
      isPdf: false
    }
  }
  return { part: { type: 'text', text: fs.readFileSync(filePath, 'utf-8') }, isPdf: false }
}

/**
 * One OpenRouter chat completion, streamed and accumulated to plain text.
 * Streaming keeps the connection alive while large reasoning models (like
 * Nemotron) think, which a plain request could time out on.
 */
export async function chatOpenRouter(opts: {
  system: string
  messages: { role: 'user' | 'assistant'; content: string | ORContentPart[] }[]
  maxTokens: number
  /** When set, asks OpenRouter to enforce this JSON schema on the output */
  schema?: { name: string; schema: Record<string, unknown> }
  /** Set when the message contains a PDF, to enable the free parser plugin */
  pdf?: boolean
}): Promise<string> {
  const key = effectiveOpenRouterKey()
  if (!key) {
    throw new Error(
      'No OpenRouter API key found. Open Settings from the home screen and paste your OpenRouter key (create one free at openrouter.ai/keys).'
    )
  }

  const body: Record<string, unknown> = {
    model: effectiveModel(),
    max_tokens: opts.maxTokens,
    stream: true,
    messages: [{ role: 'system', content: opts.system }, ...opts.messages] satisfies ORMessage[]
  }
  if (opts.schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema }
    }
  }
  if (opts.pdf) {
    // cloudflare-ai is OpenRouter's free PDF-to-text engine; it lets text-only
    // models like Nemotron read lecture PDFs
    body.plugins = [{ id: 'file-parser', pdf: { engine: 'cloudflare-ai' } }]
  }

  // Free-tier models can sit in OpenRouter's queue indefinitely while the
  // connection stays alive on keep-alive comments — give up if no real token
  // arrives in time rather than hanging forever.
  const FIRST_TOKEN_TIMEOUT_MS = 180_000
  const controller = new AbortController()
  let sawToken = false
  const firstTokenTimer = setTimeout(() => controller.abort(), FIRST_TOKEN_TIMEOUT_MS)

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'Osler'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!res.ok || !res.body) {
      let detail = `${res.status} ${res.statusText}`
      try {
        const err = (await res.json()) as { error?: { message?: string } }
        if (err.error?.message) detail = err.error.message
      } catch {
        // keep the status text
      }
      if (res.status === 429) {
        detail += ' — the free tier has daily request limits; try again later.'
      }
      throw new Error(`OpenRouter error: ${detail}`)
    }

    // Server-sent events: accumulate every delta into the final text
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue // skips keep-alive comments
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        let event: {
          choices?: { delta?: { content?: string } }[]
          error?: { message?: string }
        }
        try {
          event = JSON.parse(payload)
        } catch {
          continue
        }
        if (event.error?.message) throw new Error(`OpenRouter error: ${event.error.message}`)
        const delta = event.choices?.[0]?.delta?.content ?? ''
        if (delta && !sawToken) {
          sawToken = true
          clearTimeout(firstTokenTimer)
        }
        text += delta
      }
    }

    if (!text.trim()) throw new Error('The model returned an empty response. Please try again.')
    return text
  } catch (err) {
    if (controller.signal.aborted && !sawToken) {
      throw new Error(
        `The model did not start responding within ${FIRST_TOKEN_TIMEOUT_MS / 60000} minutes — the free tier is likely overloaded right now. Try again in a few minutes, or switch to another model in Settings.`
      )
    }
    throw err
  } finally {
    clearTimeout(firstTokenTimer)
  }
}
