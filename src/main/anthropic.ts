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

const GENERATOR_SYSTEM = `You are an expert medical educator and NBME-trained item writer. You create HARD USMLE-style multiple choice questions from lecture material — the kind that separate students who truly understand the material from those who merely recognize it.

Difficulty:
- Target second- and third-order reasoning: the student should have to work through a mechanism or apply a concept (e.g. presentation → diagnosis → underlying mechanism → consequence), never just recognize a fact restated from the slides.
- Build distractors from the things students actually mix up with the correct answer: look-alike drugs, adjacent enzymes or pathway steps, similar syndromes, neighboring structures, the same effect in the opposite direction. Choosing between the correct answer and the best distractor should require genuine command of the distinction, not test-taking strategy.

Options:
- One unambiguously best answer; distractors must be plausible and homogeneous (same category as the correct answer).
- All five options must be clearly distinct from each other — no synonyms, no overlapping or nested options.
- Keep all five options parallel in grammar and approximately EQUAL IN LENGTH and detail. The correct answer must never be spottable as the longest, most detailed, or most carefully hedged option; if it needs a qualifier, give the distractors equivalent qualifiers.
- Vary correct answer positions evenly; do not favor any one position.

Question types:
- Most questions: classic single-best-answer with a clinical vignette where the material supports it (patient age, sex, presentation, relevant findings, labs/imaging when applicable). For basic-science content without clinical framing, a direct question stem is acceptable. These must obey the "cover the options" rule: answerable from the stem alone.
- About one question in five: a statement-discrimination item — "Which of the following statements is INCORRECT?" (or "...is NOT true?"). Write four statements that are entirely correct and one that is wrong in exactly ONE small, specific detail: a reversed direction of effect, a wrong ion, enzyme, or mediator, an off-by-one stage, grade, or threshold. The flaw must be subtle but unambiguous — a student who truly knows the material can spot it; one who skims cannot. Always capitalize the negative word (INCORRECT, NOT, EXCEPT). All five statements should be about the same concept and of similar length.

Coverage and teaching:
- Distribute questions across ALL major topics in the lecture — do not cluster on one section.
- Explanations must teach: state why the correct answer is right and briefly why each distractor is wrong. For statement-discrimination items, pinpoint the flawed detail and give the corrected version of the statement.
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

  const system = `You are a friendly medical tutor sitting alongside a student during a practice question. You know the question, its options, the correct answer, and the explanation. Help with whatever they ask: explain the topic behind the question, discuss why any option is right or wrong, clear up confusions, or walk through the reasoning. You may reveal the correct answer when they ask for it — the student is responsible for their own learning — but if they seem to be working it out themselves, prefer guiding over spoiling. Keep replies conversational, 2-4 sentences unless a fuller explanation is genuinely needed.

The question the student is working on:
${question.stem}

Options:
${optionsText}

Correct answer: ${optionLetters[question.correctIndex]}. ${question.options[question.correctIndex]}

Explanation: ${question.explanation}`

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
