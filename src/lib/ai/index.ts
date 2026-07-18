// Public AI generation API (US-3.2).
//
//   const { items, provider } = await generateFlashcards({ sourceText });
//   const { items, provider } = await generateQuiz({ sourceText });
//
// The self-hosted local LLM is primary whenever LOCAL_AI_BASE_URL is set and
// AI_DEMO_MODE !== "true". Gemini is the hosted fallback. Demo cards are returned
// ONLY when AI_DEMO_MODE === "true".

import { AI_NOT_CONFIGURED_MESSAGE, getAiRuntimeStatus } from '@/lib/ai/config';
import {
  AiProviderError,
  hasConfiguredProvider,
  runWithFallback,
  type JsonPrompt,
} from '@/lib/ai/provider';
import {
  flashcardResponseSchema,
  quizResponseSchema,
  type AiAttachment,
  type AiProviderName,
  type AiResult,
  type Flashcard,
  type GenerateFlashcardsInput,
  type GenerateQuizInput,
  type QuizQuestion,
} from '@/lib/ai/types';

const DEFAULT_COUNT = 8;
const MIN_COUNT = 1;
// Upper bound for a single generation request. Quizzes allow up to 50 questions;
// flashcard requests are separately capped lower by their request validator.
const MAX_COUNT = 50;
const MAX_SOURCE_CHARS = 12_000;

function clampCount(count: number | undefined): number {
  if (!count || !Number.isFinite(count)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(count)));
}

function prepareSource(text: string): string {
  return text.trim().slice(0, MAX_SOURCE_CHARS);
}

/**
 * The source-material section of a prompt. Uses the typed notes when present,
 * points at the attached document(s) when a PDF-backed note was chosen, and
 * describes both when the note has typed text *and* a PDF.
 */
function sourceSection(source: string, attachmentCount: number): string {
  const noteBlock = source ? `\n\nNOTES:\n"""\n${source}\n"""` : '';
  if (attachmentCount === 0) return noteBlock;

  const plural = attachmentCount === 1 ? '' : 's';
  const how = source
    ? 'them together with the notes above'
    : 'the attached document(s)';
  return (
    `${noteBlock}\n\nThe user also attached ${attachmentCount} document${plural} ` +
    `(e.g. a PDF). Read ${how} as the source material.`
  );
}

/** Collapse equivalent cards (same front+back, case/whitespace-insensitive). */
export function dedupeFlashcards(cards: Flashcard[]): Flashcard[] {
  const seen = new Set<string>();
  const unique: Flashcard[] = [];
  for (const card of cards) {
    const key = `${card.front.trim().toLowerCase()}::${card.back.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      topic: card.topic.trim(),
      front: card.front.trim(),
      back: card.back.trim(),
    });
  }
  return unique;
}

function providerDisplayName(provider: AiProviderName): string {
  if (provider === 'local') return 'StudyPet+ AI';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'deepseek') return 'DeepSeek';
  return 'demo';
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

function flashcardPrompt(
  source: string,
  count: number,
  topicHint?: string,
  attachments?: AiAttachment[]
): JsonPrompt {
  const hint = topicHint?.trim()
    ? ` The course/subject context is "${topicHint.trim()}" — use it only for topic tags when it fits the source.`
    : '';
  return {
    system:
      "You are a study assistant that turns a student's notes into concise, " +
      'accurate flashcards for exam review. Rules:\n' +
      '1. Use ONLY facts explicitly present in the provided source (notes and/or attached documents).\n' +
      '2. Never invent facts, definitions, or examples that are not in the source.\n' +
      '3. Do NOT create generic study-skill cards (spaced repetition, active recall, ' +
      'how flashcards work, meta-learning tips, or how to configure AI).\n' +
      '4. Each card must test a specific concept, term, formula, or fact from the source.\n' +
      '5. Respond with JSON only — no markdown fences or commentary.',
    user:
      `Create exactly ${count} flashcards from the source material.${hint}\n\n` +
      'Return a JSON object of this exact shape:\n' +
      '{ "cards": [ { "topic": string, "front": string, "back": string } ] }\n' +
      '- "topic": a short subject/section tag grounded in the source (a few words).\n' +
      '- "front": a clear question or prompt about the source.\n' +
      '- "back": a concise answer drawn only from the source.\n' +
      '- Prefer variety across distinct facts; avoid near-duplicate cards.' +
      sourceSection(source, attachments?.length ?? 0),
    attachments,
  };
}

export async function generateFlashcards(
  input: GenerateFlashcardsInput
): Promise<AiResult<Flashcard>> {
  const source = prepareSource(input.sourceText);
  const count = clampCount(input.count);
  const attachments = input.attachments ?? [];

  if (!source && attachments.length === 0) {
    throw new Error('generateFlashcards: no source text or attachments');
  }

  const status = getAiRuntimeStatus();
  console.info('[ai] generateFlashcards start', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    count,
  });

  // Demo ONLY when AI_DEMO_MODE === "true" — never as a silent fallback.
  if (status.demoMode) {
    console.warn('[ai] generateFlashcards selected provider=demo');
    return { items: demoFlashcards(count, input.topicHint), provider: 'demo' };
  }

  if (!hasConfiguredProvider()) {
    console.error('[ai] generateFlashcards missing API keys', {
      geminiConfigured: status.geminiConfigured,
      localConfigured: status.localConfigured,
      demoMode: status.demoMode,
    });
    throw new AiProviderError('gemini', AI_NOT_CONFIGURED_MESSAGE);
  }

  const run = await runWithFallback(
    flashcardPrompt(source, count, input.topicHint, attachments),
    (value) => flashcardResponseSchema.safeParse(value).success,
    input.onProgress
  );

  const parsed = flashcardResponseSchema.parse(run.value);
  const cards = dedupeFlashcards(parsed.cards).slice(0, count);

  if (cards.length === 0) {
    throw new AiProviderError(
      run.provider,
      'provider returned no usable flashcards after validation'
    );
  }

  console.info('[ai] generateFlashcards ok', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    provider: run.provider,
    providerLabel: providerDisplayName(run.provider),
    cards: cards.length,
  });

  return { items: cards, provider: run.provider };
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

function quizPrompt(
  source: string,
  count: number,
  topicHint?: string,
  attachments?: AiAttachment[]
): JsonPrompt {
  const hint = topicHint?.trim()
    ? ` The course/subject context is "${topicHint.trim()}".`
    : '';
  return {
    system:
      'You are a study assistant that writes fair multiple-choice quiz ' +
      "questions from a student's notes and attached documents. Only use facts " +
      'present in the source; never invent material. Do not ask meta questions ' +
      'about study skills or AI. Respond with JSON only.',
    user:
      `Write ${count} multiple-choice questions from the source material.${hint}\n\n` +
      'Return a JSON object of the exact shape:\n' +
      '{ "questions": [ { "topic": string, "question": string, ' +
      '"choices": string[], "answerIndex": number, "explanation": string, ' +
      '"hint": string } ] }\n' +
      '- Provide 3-4 "choices" per question, exactly one correct.\n' +
      '- "answerIndex" is the 0-based index of the correct choice.\n' +
      '- "explanation" briefly says why the answer is correct.\n' +
      '- "hint" nudges the student toward the answer WITHOUT revealing which ' +
      'choice is correct (point at the relevant concept, not the option).' +
      sourceSection(source, attachments?.length ?? 0),
    attachments,
  };
}

export async function generateQuiz(
  input: GenerateQuizInput
): Promise<AiResult<QuizQuestion>> {
  const source = prepareSource(input.sourceText);
  const count = clampCount(input.count);
  const attachments = input.attachments ?? [];

  if (!source && attachments.length === 0) {
    throw new Error('generateQuiz: no source text or attachments');
  }

  const status = getAiRuntimeStatus();
  console.info('[ai] generateQuiz start', {
    geminiConfigured: status.geminiConfigured,
    localConfigured: status.localConfigured,
    demoMode: status.demoMode,
    count,
  });

  if (status.demoMode) {
    console.warn('[ai] generateQuiz selected provider=demo');
    return { items: demoQuiz(count, input.topicHint), provider: 'demo' };
  }

  if (!hasConfiguredProvider()) {
    console.error('[ai] generateQuiz missing API keys', {
      geminiConfigured: status.geminiConfigured,
      localConfigured: status.localConfigured,
      demoMode: status.demoMode,
    });
    throw new AiProviderError('gemini', AI_NOT_CONFIGURED_MESSAGE);
  }

  const run = await runWithFallback(
    quizPrompt(source, count, input.topicHint, attachments),
    (value) => quizResponseSchema.safeParse(value).success,
    input.onProgress
  );

  const { questions } = quizResponseSchema.parse(run.value);
  console.info('[ai] generateQuiz ok', {
    provider: run.provider,
    questions: questions.length,
  });
  return { items: questions.slice(0, count), provider: run.provider };
}

// ---------------------------------------------------------------------------
// Demo material — returned ONLY when AI_DEMO_MODE === "true".
// ---------------------------------------------------------------------------

function demoFlashcards(count: number, topicHint?: string): Flashcard[] {
  const topic = topicHint?.trim() || 'Demo';
  const base: Flashcard[] = [
    {
      topic,
      front: 'What is spaced repetition?',
      back: 'Reviewing material at increasing intervals to strengthen recall.',
    },
    {
      topic,
      front: 'Why turn notes into flashcards?',
      back: 'Active recall beats re-reading for long-term retention.',
    },
    {
      topic,
      front: '(Demo card) How do I get real cards?',
      back: 'Set LOCAL_AI_BASE_URL (or GEMINI_API_KEY) and AI_DEMO_MODE=false.',
    },
  ];
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}

function demoQuiz(count: number, topicHint?: string): QuizQuestion[] {
  const topic = topicHint?.trim() || 'Demo';
  const base: QuizQuestion[] = [
    {
      topic,
      question: 'Which study technique this quiz demonstrates?',
      choices: ['Cramming', 'Active recall', 'Highlighting', 'Re-reading'],
      answerIndex: 1,
      explanation: 'Answering questions from memory is active recall.',
      hint: 'Think about retrieving the answer from memory, not reviewing it.',
    },
    {
      topic,
      question: '(Demo) How do you enable real AI quizzes?',
      choices: [
        'Nothing is needed',
        'Set an API key and AI_DEMO_MODE=false',
        'Restart your computer',
        'Upgrade Postgres',
      ],
      answerIndex: 1,
      explanation: 'Configure LOCAL_AI_BASE_URL or GEMINI_API_KEY, demo off.',
      hint: 'It involves configuration, not hardware.',
    },
  ];
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}
