import { BrowserWindow } from 'electron'
import type { LogLevel, LogEvent } from '../shared/types'

let counter = 0
const buffer: LogEvent[] = []
const MAX_BUFFER = 200

/** Recent events, so the dev console is fully populated the moment it opens. */
export function history(): LogEvent[] {
  return buffer
}

/**
 * Emit a structured status event: prints to the terminal AND pushes it to the
 * renderer so it shows up in the in-app dev console and loading screens.
 */
export function emit(level: LogLevel, scope: string, message: string): void {
  const event: LogEvent = {
    id: ++counter,
    time: new Date().toLocaleTimeString(),
    level,
    scope,
    message
  }
  buffer.push(event)
  if (buffer.length > MAX_BUFFER) buffer.shift()
  const tag = level === 'error' ? 'ERROR' : level === 'success' ? 'OK' : 'INFO'
  console.log(`[${event.time}] [${tag}] [${scope}] ${message}`)
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('app-log', event)
  }
}

export const log = {
  info: (scope: string, message: string) => emit('info', scope, message),
  success: (scope: string, message: string) => emit('success', scope, message),
  error: (scope: string, message: string) => emit('error', scope, message)
}
