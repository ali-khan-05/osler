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
  count: number
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
}

export interface SaveSettingsArgs {
  /** Omit to leave unchanged */
  apiKey?: string
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
