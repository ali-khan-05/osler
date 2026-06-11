import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  GenerateSetArgs,
  HintArgs,
  QuestionSet,
  LogEvent,
  SaveSettingsArgs
} from '../shared/types'

const api = {
  pickFile: (): Promise<string | null> => ipcRenderer.invoke('pick-file'),
  generateSet: (args: GenerateSetArgs): Promise<QuestionSet> =>
    ipcRenderer.invoke('generate-set', args),
  listSets: (): Promise<QuestionSet[]> => ipcRenderer.invoke('list-sets'),
  deleteSet: (id: string): Promise<void> => ipcRenderer.invoke('delete-set', id),
  saveAnswers: (id: string, answers: (number | null)[]): Promise<void> =>
    ipcRenderer.invoke('save-answers', { id, answers }),
  resetSet: (id: string): Promise<QuestionSet | null> => ipcRenderer.invoke('reset-set', id),
  getHint: (args: HintArgs): Promise<string> => ipcRenderer.invoke('get-hint', args),
  getCoach: (id: string): Promise<string> => ipcRenderer.invoke('get-coach', id),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (args: SaveSettingsArgs): Promise<AppSettings> =>
    ipcRenderer.invoke('save-settings', args),
  getLogs: (): Promise<LogEvent[]> => ipcRenderer.invoke('get-logs'),
  /** Subscribe to live status events. Returns an unsubscribe function. */
  onLog: (callback: (event: LogEvent) => void): (() => void) => {
    const listener = (_e: unknown, event: LogEvent): void => callback(event)
    ipcRenderer.on('app-log', listener)
    return () => ipcRenderer.removeListener('app-log', listener)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
