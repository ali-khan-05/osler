import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import { extname, basename } from 'path'
import type { Question, QuestionSet, HintArgs } from '../shared/types'
import { effectiveApiKey, effectiveModel, provider } from './settings'
import { chatOpenRouter, fileToOpenRouterPart, type ORLecture } from './openrouter'
import { log } from './log'

const MODEL = (): string => effectiveModel()

// Haiku doesn't support adaptive thinking, so it gets a fixed thinking budget instead
const THINKING = (): Anthropic.ThinkingConfigParam =>
  MODEL().includes('haiku') ? { type: 'enabled', budget_tokens: 4000 } : { type: 'adaptive' }

let client: Anthropic | null = null
let clientKey: string | null = null

// Re-created whenever the key changes in Settings, so a new key applies without restarting
function getClient(): Anthropic {
  const key = effectiveApiKey()
  if (!key) {
    throw new Error(
      'No API key found. Open Settings from the home screen and paste your Anthropic API key.'
    )
  }
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key })
    clientKey = key
  }
  return client
}

const IMAGE_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

// cache_control: the lecture is sent once per batch (and again on regeneration);
// caching bills it at ~10% after the first request instead of full price every time.
function fileToContentBlock(filePath: string): Anthropic.ContentBlockParam {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.pdf') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: fs.readFileSync(filePath).toString('base64')
      },
      cache_control: { type: 'ephemeral' }
    }
  }
  if (ext in IMAGE_TYPES) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: IMAGE_TYPES[ext],
        data: fs.readFileSync(filePath).toString('base64')
      },
      cache_control: { type: 'ephemeral' }
    }
  }
  return {
    type: 'text',
    text: fs.readFileSync(filePath, 'utf-8'),
    cache_control: { type: 'ephemeral' }
  }
}

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stem: {
            type: 'string',
            description: 'Full question including the clinical vignette where appropriate'
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exactly 5 answer options, without letter prefixes'
          },
          correctIndex: { type: 'integer', enum: [0, 1, 2, 3, 4] },
          explanation: {
            type: 'string',
            description: 'Why the correct answer is right and each distractor is wrong'
          },
          topic: {
            type: 'string',
            description: 'Short topic label from the lecture this question tests'
          }
        },
        required: ['stem', 'options', 'correctIndex', 'explanation', 'topic'],
        additionalProperties: false
      }
    }
  },
  required: ['questions'],
  additionalProperties: false
} as const

const GENERATOR_SYSTEM = `You are an expert medical educator and NBME-trained item writer. You create USMLE-style single-best-answer multiple choice questions from lecture material.

Follow NBME item-writing standards:
- Use clinical vignettes where the material supports them (patient age, sex, presentation, relevant findings, labs/imaging when applicable). For basic-science content without clinical framing, a direct question stem is acceptable.
- One unambiguously best answer; distractors must be plausible and homogeneous (same category as the correct answer).
- The question must be answerable from the stem alone ("cover the options" rule). Avoid "which of the following is true/false", "all of the following except", and negatively phrased stems.
- Test understanding and application, not trivia or rote recall of the slide wording.
- Distribute questions across ALL major topics in the lecture — do not cluster on one section.
- Vary correct answer positions evenly; do not favor any one position.
- Explanations must teach: state why the correct answer is right and briefly why each distractor is wrong.
- Each question gets a short topic tag naming the lecture concept it tests (e.g. "Beta-blocker pharmacology", "Cardiac action potential phase 2"). Reuse identical tags for questions on the same concept.`

const BATCH_SIZE = 5

/** The lecture block is provider-shaped, built once per generation run. */
type Lecture =
  | { provider: 'anthropic'; block: Anthropic.ContentBlockParam }
  | { provider: 'openrouter'; lecture: ORLecture }

/** Tolerates reasoning models that wrap the JSON in prose or code fences. */
function parseQuestions(text: string): Question[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('The model returned no questions. Please try again.')
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as { questions: Question[] }
  if (!parsed.questions?.length) throw new Error('No questions were generated. Please try again.')
  return parsed.questions
}

async function generateBatch(
  lecture: Lecture,
  batchCount: number,
  part: number,
  totalParts: number
): Promise<Question[]> {
  const prompt =
    totalParts === 1
      ? `These are my lecture slides. Generate exactly ${batchCount} USMLE-style practice questions covering all parts of this lecture. Each question must have exactly 5 answer options.`
      : `These are my lecture slides. I am building a full practice set in ${totalParts} sections, one request per section. Mentally divide the lecture content into ${totalParts} roughly equal consecutive parts; this request covers part ${part} of ${totalParts} ONLY. Generate exactly ${batchCount} USMLE-style practice questions drawn only from that part of the lecture, so the combined set covers everything without overlap. Each question must have exactly 5 answer options.`

  if (lecture.provider === 'openrouter') {
    const text = await chatOpenRouter({
      system: GENERATOR_SYSTEM,
      messages: [{ role: 'user', content: [lecture.lecture.part, { type: 'text', text: prompt }] }],
      maxTokens: 16000,
      schema: {
        name: 'practice_questions',
        schema: QUESTION_SCHEMA as unknown as Record<string, unknown>
      },
      pdf: lecture.lecture.isPdf
    })
    return parseQuestions(text)
  }

  const stream = getClient().messages.stream({
    model: MODEL(),
    max_tokens: 16000,
    thinking: THINKING(),
    system: GENERATOR_SYSTEM,
    output_config: {
      format: { type: 'json_schema', schema: QUESTION_SCHEMA as unknown as Record<string, unknown> }
    },
    messages: [
      {
        role: 'user',
        content: [lecture.block, { type: 'text', text: prompt }]
      }
    ]
  })
  stream.on('error', (err) =>
    log.error('generate', `Stream error (part ${part}/${totalParts}): ${err instanceof Error ? err.message : String(err)}`)
  )
  const message = await stream.finalMessage()
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('The model returned no questions. Please try again.')
  return parseQuestions(text)
}

export interface GenerationStart {
  /** The first batch, ready to use immediately */
  questions: Question[]
  /**
   * Kicks off the remaining batches in parallel; onBatch fires as each one
   * finishes (a failed batch reports as empty so `done` always arrives).
   * Null when the first batch was the whole set.
   */
  generateRest: ((onBatch: (questions: Question[], done: boolean) => void) => void) | null
}

export async function generateQuestions(filePath: string, count: number): Promise<GenerationStart> {
  const sizeMb = fs.statSync(filePath).size / 1024 / 1024
  log.info('generate', `Reading ${basename(filePath)} (${sizeMb.toFixed(1)} MB) · ${count} questions · ${MODEL()}`)
  const lecture: Lecture =
    provider() === 'openrouter'
      ? { provider: 'openrouter', lecture: await fileToOpenRouterPart(filePath) }
      : { provider: 'anthropic', block: fileToContentBlock(filePath) }
  const parts = Math.ceil(count / BATCH_SIZE)
  const sizes = Array.from({ length: parts }, (_, i) => Math.floor(count / parts) + (i < count % parts ? 1 : 0))

  if (parts === 1) {
    log.info('generate', 'Request sent, waiting for the model…')
    const questions = await generateBatch(lecture, count, 1, 1)
    log.success('generate', `Created ${questions.length} questions`)
    return { questions, generateRest: null }
  }

  // The first batch runs alone so it writes the lecture into the prompt cache;
  // the remaining batches then run in parallel and read it back at ~10% cost.
  log.info('generate', `Splitting into ${parts} batches — writing part 1 of the lecture…`)
  const first = await generateBatch(lecture, sizes[0], 1, parts)
  log.info('generate', `Part 1/${parts} ready (${first.length} questions) — starting the quiz while the rest generate`)

  const generateRest = (onBatch: (questions: Question[], done: boolean) => void): void => {
    let settled = 0
    let total = first.length
    sizes.slice(1).forEach((batchCount, i) => {
      generateBatch(lecture, batchCount, i + 2, parts)
        .catch((err) => {
          log.error('generate', `Part ${i + 2}/${parts} failed: ${err instanceof Error ? err.message : String(err)}`)
          return [] as Question[]
        })
        .then((qs) => {
          settled += 1
          total += qs.length
          if (qs.length) log.info('generate', `Part ${settled + 1}/${parts} done (${qs.length} questions)`)
          const done = settled === parts - 1
          if (done) log.success('generate', `Created ${total} questions`)
          onBatch(qs, done)
        })
    })
  }
  return { questions: first, generateRest }
}

export async function getHint(args: HintArgs): Promise<string> {
  const { question, history, message } = args
  const optionLetters = ['A', 'B', 'C', 'D', 'E']
  const optionsText = question.options.map((o, i) => `${optionLetters[i]}. ${o}`).join('\n')

  const system = `You are a friendly medical tutor helping a student work through a practice question. You know the question and its answer, but you must NEVER reveal the correct answer, the correct letter, or directly eliminate options for the student. Guide them Socratically: point them toward the relevant concept, ask what they notice in the vignette, or remind them of the underlying mechanism. Keep replies to 2-4 sentences.

The question the student is working on:
${question.stem}

Options:
${optionsText}

Correct answer (NEVER reveal): ${optionLetters[question.correctIndex]}. ${question.options[question.correctIndex]}

Explanation (for your reference only): ${question.explanation}`

  log.info('tutor', 'Asking the tutor for a hint…')
  let reply: string
  if (provider() === 'openrouter') {
    reply = await chatOpenRouter({
      system,
      messages: [...history, { role: 'user' as const, content: message }],
      maxTokens: 1024
    })
  } else {
    const response = await getClient().messages.create({
      model: MODEL(),
      max_tokens: 1024,
      system,
      messages: [...history, { role: 'user' as const, content: message }]
    })
    reply = response.content.find((b) => b.type === 'text')?.text ?? ''
  }
  log.success('tutor', 'Hint received')
  return reply
}

export async function getCoachReport(set: QuestionSet): Promise<string> {
  log.info('coach', 'Analyzing your results and writing a study plan…')
  const optionLetters = ['A', 'B', 'C', 'D', 'E']
  const results = set.questions
    .map((q, i) => {
      const userAnswer = set.answers[i]
      const correct = userAnswer === q.correctIndex
      return `Q${i + 1} [Topic: ${q.topic}] — ${correct ? 'CORRECT' : 'INCORRECT'}
Question: ${q.stem}
Correct answer: ${optionLetters[q.correctIndex]}. ${q.options[q.correctIndex]}${
        userAnswer !== null && !correct
          ? `\nStudent chose: ${optionLetters[userAnswer]}. ${q.options[userAnswer]}`
          : ''
      }`
    })
    .join('\n\n')

  const system = `You are a supportive medical school study coach. A student just completed a practice question set generated from their lecture slides. Analyze their performance and tell them what to go back and study.

Write in plain text (no markdown symbols like # or *). Structure your report exactly as:

OVERALL
One or two sentences on their performance with the score.

STRONG AREAS
Topics they clearly understand (bullet each line with "- "). If none, say so kindly.

NEEDS REVIEW
The most important section. For each weak topic: name the concept from the lecture, explain in one sentence what their wrong answer suggests they misunderstood, and say specifically what to review. Bullet each with "- ". Group related misses into one item.

STUDY PLAN
2-4 concrete, ordered steps for their next study session (bullet with "- ").

Be specific to the actual content — name mechanisms, drugs, pathways from the questions. Never be generic.`
  const userMessage = `Here are my results on "${set.title}" (${set.questions.length} questions):\n\n${results}`

  let report: string
  if (provider() === 'openrouter') {
    report = await chatOpenRouter({
      system,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 16000
    })
  } else {
    const response = await getClient().messages.create({
      model: MODEL(),
      max_tokens: 16000,
      thinking: THINKING(),
      system,
      messages: [{ role: 'user', content: userMessage }]
    })
    report = response.content.find((b) => b.type === 'text')?.text ?? ''
  }
  log.success('coach', 'Coach report ready')
  return report
}
