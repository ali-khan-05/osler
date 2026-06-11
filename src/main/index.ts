import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { listSets, getSet, saveSet, deleteSet, listTopics, saveTopics, ensureTopic } from './store'
import { generateQuestions, getHint, getCoachReport } from './anthropic'
import { getAppSettings, saveSettings } from './settings'
import { log, history } from './log'
import type {
  GenerateSetArgs,
  GenerateSetResult,
  HintArgs,
  QuestionSet,
  SaveSettingsArgs,
  SetUpdate
} from '../shared/types'

config({ path: join(app.getAppPath(), '.env') })

/**
 * Register an IPC handler that surfaces any thrown error to the in-app dev
 * console before rethrowing, so failures are never silent during testing.
 */
function handle<T>(
  channel: string,
  fn: (...args: unknown[]) => T | Promise<T>
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (err) {
      log.error(channel, err instanceof Error ? err.message : String(err))
      throw err
    }
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'Osler',
    backgroundColor: '#FAF7F0',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  handle('get-logs', () => history())

  handle('pick-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Lecture files', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Resolves as soon as the first batch is ready so the quiz can start;
  // later batches are appended to the stored set and pushed via 'set-updated'.
  handle('generate-set', async (...args): Promise<GenerateSetResult> => {
    const a = args[0] as GenerateSetArgs
    const { questions, generateRest } = await generateQuestions(a.filePath, a.count)
    const set: QuestionSet = {
      id: randomUUID(),
      title: a.title,
      topic: a.topic,
      createdAt: new Date().toISOString(),
      sourceFile: a.filePath,
      questions,
      answers: questions.map(() => null),
      coachReport: null
    }
    ensureTopic(set.topic)
    saveSet(set)
    generateRest?.((batch, done) => {
      // Disk is the source of truth — the user is already answering this set
      const current = getSet(set.id)
      if (!current) return // set was deleted mid-generation
      current.questions.push(...batch)
      current.answers.push(...batch.map(() => null))
      saveSet(current)
      const update: SetUpdate = { set: current, done }
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('set-updated', update)
      }
    })
    return { set, generating: generateRest !== null }
  })

  handle('list-sets', () => listSets())

  handle('delete-set', (...args) => {
    deleteSet(args[0] as string)
  })

  handle('save-answers', (...args) => {
    const a = args[0] as { id: string; answers: (number | null)[] }
    const set = getSet(a.id)
    if (!set) return
    // questions may have grown since the renderer sent these answers — pad with nulls
    set.answers = set.questions.map((_, i) => a.answers[i] ?? null)
    // answers changed, so any existing coach report no longer describes them
    set.coachReport = null
    saveSet(set)
  })

  handle('set-topic', (...args) => {
    const a = args[0] as { id: string; topic: string | null }
    const set = getSet(a.id)
    if (!set) return
    set.topic = a.topic?.trim() || undefined
    ensureTopic(set.topic)
    saveSet(set)
  })

  handle('list-topics', () => listTopics())

  handle('add-topic', (...args) => {
    const name = (args[0] as string).trim()
    if (name) ensureTopic(name)
    return listTopics()
  })

  handle('remove-topic', (...args) => {
    const name = args[0] as string
    saveTopics(listTopics().filter((t) => t !== name))
    // unfile any sets still under it
    for (const set of listSets()) {
      if (set.topic === name) {
        set.topic = undefined
        saveSet(set)
      }
    }
    return listTopics()
  })

  // Snapshot the score of a completed run into the set's attempt history.
  // No-op (returns the set unchanged) if any question is still unanswered,
  // e.g. a new batch arrived between the last answer and the finish click.
  handle('record-attempt', (...args) => {
    const set = getSet(args[0] as string)
    if (!set) return null
    if (set.questions.length === 0 || set.answers.some((a) => a === null)) return set
    const correct = set.questions.filter((q, i) => set.answers[i] === q.correctIndex).length
    set.attempts = [
      ...(set.attempts ?? []),
      { date: new Date().toISOString(), correct, total: set.questions.length }
    ]
    saveSet(set)
    return set
  })

  handle('reset-set', (...args) => {
    const set = getSet(args[0] as string)
    if (!set) return null
    set.answers = set.questions.map(() => null)
    set.coachReport = null
    saveSet(set)
    return set
  })

  handle('get-settings', () => getAppSettings())

  handle('save-settings', (...args) => {
    const a = args[0] as SaveSettingsArgs
    saveSettings(a)
    const next = getAppSettings()
    log.success(
      'settings',
      `Settings saved — model: ${next.model}${a.apiKey ? ', Anthropic key updated' : ''}${a.openrouterApiKey ? ', OpenRouter key updated' : ''}`
    )
    return next
  })

  handle('get-hint', (...args) => getHint(args[0] as HintArgs))

  handle('get-coach', async (...args) => {
    const set = getSet(args[0] as string)
    if (!set) throw new Error('Question set not found.')
    const report = await getCoachReport(set)
    // re-read before saving — an attempt may have been recorded while the model ran
    const fresh = getSet(set.id) ?? set
    fresh.coachReport = report
    saveSet(fresh)
    return report
  })

  log.info('app', 'Osler ready')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
