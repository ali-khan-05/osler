import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { listSets, getSet, saveSet, deleteSet } from './store'
import { generateQuestions, getHint, getCoachReport } from './anthropic'
import { getAppSettings, saveSettings } from './settings'
import { log, history } from './log'
import type { GenerateSetArgs, HintArgs, QuestionSet, SaveSettingsArgs } from '../shared/types'

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

  handle('generate-set', async (...args) => {
    const a = args[0] as GenerateSetArgs
    const questions = await generateQuestions(a.filePath, a.count)
    const set: QuestionSet = {
      id: randomUUID(),
      title: a.title,
      createdAt: new Date().toISOString(),
      sourceFile: a.filePath,
      questions,
      answers: questions.map(() => null),
      coachReport: null
    }
    saveSet(set)
    return set
  })

  handle('list-sets', () => listSets())

  handle('delete-set', (...args) => {
    deleteSet(args[0] as string)
  })

  handle('save-answers', (...args) => {
    const a = args[0] as { id: string; answers: (number | null)[] }
    const set = getSet(a.id)
    if (!set) return
    set.answers = a.answers
    saveSet(set)
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
      `Settings saved — model: ${next.model}${a.apiKey ? ', API key updated' : ''}`
    )
    return next
  })

  handle('get-hint', (...args) => getHint(args[0] as HintArgs))

  handle('get-coach', async (...args) => {
    const set = getSet(args[0] as string)
    if (!set) throw new Error('Question set not found.')
    const report = await getCoachReport(set)
    set.coachReport = report
    saveSet(set)
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
