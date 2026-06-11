# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Osler — an Electron desktop app for medical students that turns lecture-slide PDFs into USMLE-style practice questions via the Claude API, with an AI hint tutor and a post-quiz study coach. The end user is a non-developer; the app is run, not packaged/distributed (yet).

## Commands

```bash
npm run dev        # electron-vite dev — builds main/preload, starts renderer dev server, launches the window
npm run build      # production build of all three processes into out/
npx tsc --noEmit   # type-check (do this before/after edits; there is no test or lint setup)
```

There are **no tests and no linter/formatter** configured. Type-checking is the only automated gate.

### Running the app to verify changes
`npm run dev` is long-running (it owns the Electron window). Launch it in the background, then read the log it writes — do not block on it. The main process logs every step of each Claude operation to stdout (via `log.*` — see `src/main/log.ts` under Architecture), so the dev log is the primary way to see what the app is doing without watching the window. The same events also appear in the app's own bottom-bar console.

### Electron binary gotcha (this machine)
`npm install` here has left the Electron binary partially extracted (`node_modules/electron/dist` missing `Frameworks/`, no `path.txt`), causing `Error: Electron uninstall` or a dyld framework-not-loaded crash on launch. Fix: the artifact is already cached, so re-extract it rather than re-download —
```bash
ditto -x -k ~/Library/Caches/electron/*/electron-v*-darwin-*.zip node_modules/electron/dist
printf "Electron.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
```
May recur after any `npm install`. `package.json` pins `allowScripts` for `electron` and `esbuild` because npm's script policy blocks their postinstall by default.

## Architecture

Three Electron processes, plus shared types. Build config is `electron.vite.config.ts`; Tailwind v4 is a Vite plugin (no `tailwind.config.js` — theme tokens live in `src/renderer/src/styles.css` under `@theme`).

**`src/main/`** — Node side. Owns the Claude API key and all network/disk I/O.
- `index.ts` — creates the window, loads `.env` from `app.getAppPath()`, and registers every IPC handler. Handlers go through a local `handle()` wrapper that catches any thrown error, broadcasts it via `log.error` (so it lands in the in-app console), then rethrows so the renderer's own catch still fires.
- `anthropic.ts` — the three model operations (generate / hint / coach), each branching on `provider()`. Question generation uses structured outputs (`QUESTION_SCHEMA`) and runs in **batches of 5** (`generateBatch`): the first batch runs alone (on Anthropic this also writes the lecture into the prompt cache via `cache_control`), then `generateQuestions` **returns immediately** with `{ questions, generateRest }` so the quiz can start; the caller invokes `generateRest(onBatch)` to run the remaining batches in parallel, each assigned a different slice of the lecture (a failed batch reports as an empty array so `done` always fires). On Anthropic, `THINKING()` picks adaptive thinking, or a fixed budget on Haiku, which doesn't support adaptive. `GENERATOR_SYSTEM` deliberately targets hard items: second/third-order reasoning, distractors built from commonly-confused look-alikes, options kept parallel and equal-length so the longest is never a giveaway, and ~1 in 5 questions a "which statement is INCORRECT" item whose wrong statement has exactly one subtle flaw (negative stems are intentionally allowed here, against usual NBME style). The hint tutor is given the correct answer and explanation and may discuss or reveal them freely — it's a general topic-discussion chat that just leans toward guiding when the student is still working the question out. The Anthropic client is lazily constructed (and rebuilt on key change) so a missing key throws a user-facing message instead of crashing at startup. Each operation emits `log.*` status events at every step.
- The `generate-set` handler in `index.ts` saves the set after the first batch, returns `{ set, generating }`, then appends each later batch to the stored set and broadcasts a `SetUpdate` on the **`set-updated` channel**; the open `Quiz` subscribes via `onSetUpdated` and grows in place. `save-answers` pads answers to the (possibly still growing) question count and **nulls `coachReport`** since the old report no longer describes the answers (this is what makes redo-wrong regenerate the coach). The `record-attempt` handler appends a scored `Attempt` (`{ date, correct, total }`) to the set's `attempts[]` when a run finishes (no-op if any answer is still null), powering the Results attempt-history bars and Home trend/mastery indicators; `get-coach` **re-reads the set from disk before saving** the report so a concurrently-recorded attempt isn't clobbered.
- `store.ts` — persistence is **one JSON file per `QuestionSet`** in `userData/question-sets/`. No database. Corrupt files are skipped, not fatal. Topic folders for the home screen live in `userData/topics.json` (`listTopics`/`saveTopics`/`ensureTopic`) so empty topics survive; sets reference them by name via the optional `set.topic`, and `remove-topic` unfiles its sets.
- `settings.ts` — model + API key overrides in `userData/settings.json`, edited via the in-app Settings page. `effectiveApiKey()`/`effectiveModel()` resolve settings-file → `.env` → default; `getAppSettings()` is the renderer-safe view (key masked, never sent in full). The Anthropic client is rebuilt when the key changes, so a new key applies without restart.
- `log.ts` — `log.info/success/error(scope, message)` prints to stdout, keeps a ~200-event ring buffer (`history()`), **and** broadcasts a structured `LogEvent` to the renderer over the `app-log` channel. The buffer back-fills the console via the `get-logs` IPC so it shows history when first opened. `LogEvent`/`LogLevel` live in `src/shared/types.ts` (shared with the renderer).

**`src/preload/index.ts`** — the only bridge. Exposes `window.api` via `contextBridge`; its `Api` type is imported by the renderer (`src/renderer/src/env.d.ts`). `sandbox: false` is set so the preload can use Node-style imports. Note `onLog(cb)` is a subscription (wraps `ipcRenderer.on('app-log')`) that returns an unsubscribe function — unlike the other methods, which are one-shot `invoke` calls.

**`src/renderer/src/`** — React UI, cream/serif minimal aesthetic. `App.tsx` is a hand-rolled view state machine (`onboarding | home | new | quiz | results | settings`) — no router; it wraps everything in `LogProvider` and renders the always-present `DevConsole`. First launch shows `onboarding` unless the `osler-onboarded` localStorage flag is set (written on finish/skip). It also owns the quiz-run plumbing: `quizIndices` (subset of question indices for redo-wrong mode, passed to `Quiz` as `indices`) and `quizRun` (bumped on every quiz entry and used in `Quiz`'s `key` so it remounts fresh); `handleFinished` calls the `record-attempt` IPC to snapshot the run before showing results. Components: `Onboarding` (4-slide first-run tour with self-playing animated demos), `Home` (topic sections with drag-and-drop filing, ＋ Add topic, per-card ⋯ menu whose "Move to another topic" item opens a hover flyout submenu that flips sides near the window edge, per-topic mastery ring and per-card score/trend pill that color-inverts on row hover, and the `OslerMark` logo — an EKG badge that beats on hover), `NewSet` (file + title + optional topic; shows an animated "writing questions" loader while the first batch generates), `Quiz` (runs the full set or an `indices` subset; **1–5 keys answer, Enter/arrows navigate**; renders `ChatPanel` as the hint sidebar), `Results` (animated count-up score ring, verdict line, per-question dot strip, confetti on 90%+, attempt-history bars, redo-wrong/retake buttons, collapsible coach report, expandable per-question answer review), `Settings` (model picker + OpenRouter key entry), `DevConsole` (bottom status bar + collapsible activity log, toggled with ⌘\`). Shared SVG icons and the `OslerMark` brand badge live in `components/icons.tsx`; animation keyframes (`rise-in`, `pop-in`, `slide-in`, `shimmer`, `confetti-fall`, `ekg-dash`, `heartbeat`, …) live in `styles.css` and are all gated by a global `prefers-reduced-motion` rule.
- `logs.tsx` — `LogProvider` subscribes to `app-log` **once** at the root and back-fills from `get-logs`; consumers read it via `useLogs()` (full list) or `useLatestStatus(scope?)` (latest line, optionally filtered by scope). Loading screens use `useLatestStatus('generate' | 'coach')` to narrate progress, so add a matching `log.*` scope in the main process when you build a new long-running operation.

### The IPC contract (read this before adding a feature)
Renderer never touches the API or filesystem directly. Every capability is a round-trip that must be wired in **four places**, and they must stay in sync:
1. `src/shared/types.ts` — the argument/return types.
2. `src/main/index.ts` — an `ipcMain.handle('name', ...)`.
3. `src/preload/index.ts` — a method on the `api` object that calls `ipcRenderer.invoke('name', ...)`.
4. the renderer component that calls `window.api.name(...)`.

Adding a Claude-backed feature also means a function in `src/main/anthropic.ts`. Use `log.*` inside long main-process operations so progress/errors surface in the UI rather than only the terminal.

The `DevConsole` is a `fixed` bottom bar ~2rem tall. Full-height views must reserve that space — `Quiz` uses `h-[calc(100vh-2rem)]` and the `App` wrapper has `pb-8`. Any new full-screen view needs the same, or its bottom edge hides behind the status bar.

## Conventions

- Model and API keys come from the in-app Settings page (`userData/settings.json`), falling back to `.env` (`ANTHROPIC_MODEL`/`ANTHROPIC_API_KEY`/`OPENROUTER_API_KEY`). `claude-opus-4-8` is the most capable, `claude-sonnet-4-6` balanced, `claude-haiku-4-5` cheapest/fastest; via OpenRouter: `deepseek/deepseek-v4-pro` (paid, ~4¢/set), `nvidia/nemotron-3-super-120b-a12b:free` (usually responsive) and `nvidia/nemotron-3-ultra-550b-a55b:free` (often queued for minutes — chatOpenRouter aborts if no token arrives in 3 min). New Claude models may need a `THINKING()` check — not all support adaptive thinking.
- **Two providers.** `settings.ts#provider()` picks by model id: a `/` in the id (e.g. `nvidia/…`) means OpenRouter, otherwise Anthropic. `src/main/openrouter.ts` holds the raw OpenRouter call (OpenAI-compatible chat completions, streamed SSE accumulated to text, `response_format: json_schema` for structured output); the three operations in `anthropic.ts` branch on `provider()`. For the OpenRouter path, `fileToOpenRouterPart` (**async**) extracts the PDF's text layer **locally** via `pdf-parse` and sends it as a plain text part — the OpenRouter models Osler offers are text-only anyway, and OpenRouter's free `file-parser` plugin 400s ("Failed to parse") on large or image-heavy decks while also being slower/heavier (megabytes of base64). It falls back to uploading the raw PDF as a `file` block with the `file-parser`/`cloudflare-ai` plugin only when local extraction yields almost no text (scanned slides needing OCR). `pdf-parse` is imported from `pdf-parse/lib/pdf-parse.js` to skip its import-time debug self-test, with an ambient type in `src/main/pdf-parse.d.ts`. Note Nemotron cannot see diagrams, only extracted text. Free OpenRouter models have daily request limits (429s surface in the console).
- API keys are read only in the main process — they must never reach the renderer (the renderer only ever gets a masked preview via `get-settings`). Never ask the user to paste one into chat; point them to the Settings page.
- PowerPoint is not supported as input; lectures must be PDF (or image/text). On the **Anthropic** path PDFs are sent as `document` blocks so Claude can read diagrams; on the **OpenRouter** path the text layer is extracted locally instead (see "Two providers" above).
