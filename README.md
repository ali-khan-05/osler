# Osler

Turn your lecture slides into USMLE-style practice questions, with an AI tutor for hints and an AI coach that tells you what to restudy.

## One-time setup

1. Open the `.env` file in this folder with any text editor.
2. Paste your Anthropic API key after `ANTHROPIC_API_KEY=` (no quotes, no spaces).
3. Save the file.

## Starting the app

Open Terminal in this folder and run:

```
npm run dev
```

The app window opens automatically. Quit with Cmd+Q. If you ever change `.env`, quit and run `npm run dev` again.

## How to use

1. **New question set** → choose your lecture file (PDF works best — export PowerPoint slides as PDF), pick how many questions, and generate.
2. Answer questions one at a time. The **Tutor** panel on the right gives Socratic hints without spoiling the answer.
3. After each answer you see the explanation and the topic it tests.
4. Finish the set to get your **coach's notes** — what you know, what to review, and a study plan.
5. Sets are saved automatically. Leave mid-set and resume later from the home screen.

## Changing the AI model

Edit `ANTHROPIC_MODEL` in `.env`. Default is `claude-opus-4-8` (most capable). For cheaper generation use `claude-sonnet-4-6`.

## Where your data lives

Question sets are stored locally at `~/Library/Application Support/osler/question-sets/`. Nothing is stored in the cloud; the only network calls are to the Anthropic API.
