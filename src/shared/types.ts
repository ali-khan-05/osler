export interface Question {
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
  topic: string
}

export interface QuestionSet {
  id: string
  title: string
  /** Folder the set is filed under on the home screen, e.g. "Cardiology" */
  topic?: string
  createdAt: string
  sourceFile: string
  questions: Question[]
  /** User's chosen option index per question, null if unanswered */
  answers: (number | null)[]
  coachReport: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateSetArgs {
  filePath: string
  title: string
  topic?: string
  count: number
}

export interface GenerateSetResult {
  set: QuestionSet
  /** true if more batches are still generating; they arrive via onSetUpdated */
  generating: boolean
}

export interface SetUpdate {
  set: QuestionSet
  /** true once the final batch has arrived (even if some batches failed) */
  done: boolean
}

export interface HintArgs {
  question: Question
  history: ChatMessage[]
  message: string
}

export interface AppSettings {
  model: string
  modelSource: 'settings' | 'env' | 'default'
  /** e.g. "sk-ant-api…h2Qa" — the full key never reaches the renderer */
  maskedApiKey: string | null
  keySource: 'settings' | 'env' | 'none'
  maskedOpenRouterKey: string | null
  openRouterKeySource: 'settings' | 'env' | 'none'
}

export interface SaveSettingsArgs {
  /** Omit to leave unchanged */
  apiKey?: string
  /** Omit to leave unchanged */
  openrouterApiKey?: string
  /** Omit to leave unchanged */
  model?: string
}

export type LogLevel = 'info' | 'success' | 'error'

export interface LogEvent {
  id: number
  time: string
  level: LogLevel
  scope: string
  message: string
}
