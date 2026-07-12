// Public AI generation API (US-3.2).
//
// This is the interface US-3.3 (flashcards) and US-3.4 (quizzes) consume:
//
//   const { items, provider } = await generateFlashcards({ sourceText });
//   const { items, provider } = await generateQuiz({ sourceText });
//
// Callers get schema-validated, ready-to-persist data and never touch a model
// directly. Under the hood this asks the provider chain (Gemini → DeepSeek) for
// a JSON object and validates it. Canned demo material is returned only when
// AI_DEMO_MODE=true. With no API key and demo off, generation fails clearly
// so callers know to configure GEMINI_API_KEY or DEEPSEEK_API_KEY.

import { isDemoModeForced } from '@/lib/ai/config';
import {
  AiProviderError,
  hasConfiguredProvider,
  runWithFallback,
  type JsonPrompt,
} from '@/lib/ai/provider';
import {
  flashcardResponseSchema,
  quizResponseSchema,
  type AiResult,
  type Flashcard,
  type GenerateFlashcardsInput,
  type GenerateQuizInput,
  type QuizQuestion,
} from '@/lib/ai/types';

const DEFAULT_COUNT = 8;
const MIN_COUNT = 1;
const MAX_COUNT = 20;
// Keep prompts (and cost) bounded — the source text is truncated to this.
const MAX_SOURCE_CHARS = 12_000;

function clampCount(count: number | undefined): number {
  if (!count || !Number.isFinite(count)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(count)));
}

function prepareSource(text: string): string {
  return text.trim().slice(0, MAX_SOURCE_CHARS);
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

function flashcardPrompt(
  source: string,
  count: number,
  topicHint?: string
): JsonPrompt {
  const hint = topicHint?.trim()
    ? ` The overall subject is "${topicHint.trim()}".`
    : '';
  return {
    system:
      "You are a study assistant that turns a student's notes into concise, " +
      'accurate flashcards. Only use facts present in the provided notes; never ' +
      'invent material. Respond with JSON only.',
    user:
      `Create ${count} flashcards from the notes below.${hint}\n\n` +
      'Return a JSON object of the exact shape:\n' +
      '{ "cards": [ { "topic": string, "front": string, "back": string } ] }\n' +
      '- "topic": a short subject/section tag (a few words).\n' +
      '- "front": a question or prompt.\n' +
      '- "back": the concise answer.\n\n' +
      `NOTES:\n"""\n${source}\n"""`,
  };
}

export async function generateFlashcards(
  input: GenerateFlashcardsInput
): Promise<AiResult<Flashcard>> {
  const source = prepareSource(input.sourceText);
  const count = clampCount(input.count);

  if (!source) {
    throw new Error('generateFlashcards: sourceText is empty');
  }

  if (isDemoModeForced()) {
    return { items: demoFlashcards(count, input.topicHint), provider: 'demo' };
  }

  if (!hasConfiguredProvider()) {
    throw new AiProviderError(
      'gemini',
      'no AI providers are configured — set GEMINI_API_KEY or DEEPSEEK_API_KEY'
    );
  }

  const run = await runWithFallback(
    flashcardPrompt(source, count, input.topicHint),
    (value) => flashcardResponseSchema.safeParse(value).success
  );

  // Safe: runWithFallback only returns values that passed this same schema.
  const { cards } = flashcardResponseSchema.parse(run.value);
  return { items: cards.slice(0, count), provider: run.provider };
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

function quizPrompt(
  source: string,
  count: number,
  topicHint?: string
): JsonPrompt {
  const hint = topicHint?.trim()
    ? ` The overall subject is "${topicHint.trim()}".`
    : '';
  return {
    system:
      'You are a study assistant that writes fair multiple-choice quiz ' +
      "questions from a student's notes. Only use facts present in the notes; " +
      'never invent material. Respond with JSON only.',
    user:
      `Write ${count} multiple-choice questions from the notes below.${hint}\n\n` +
      'Return a JSON object of the exact shape:\n' +
      '{ "questions": [ { "topic": string, "question": string, ' +
      '"choices": string[], "answerIndex": number, "explanation": string } ] }\n' +
      '- Provide 3-4 "choices" per question, exactly one correct.\n' +
      '- "answerIndex" is the 0-based index of the correct choice.\n' +
      '- "explanation" briefly says why the answer is correct.\n\n' +
      `NOTES:\n"""\n${source}\n"""`,
  };
}

export async function generateQuiz(
  input: GenerateQuizInput
): Promise<AiResult<QuizQuestion>> {
  const source = prepareSource(input.sourceText);
  const count = clampCount(input.count);

  if (!source) {
    throw new Error('generateQuiz: sourceText is empty');
  }

  if (isDemoModeForced()) {
    return { items: demoQuiz(count, input.topicHint), provider: 'demo' };
  }

  if (!hasConfiguredProvider()) {
    throw new AiProviderError(
      'gemini',
      'no AI providers are configured — set GEMINI_API_KEY or DEEPSEEK_API_KEY'
    );
  }

  const run = await runWithFallback(
    quizPrompt(source, count, input.topicHint),
    (value) => quizResponseSchema.safeParse(value).success
  );

  const { questions } = quizResponseSchema.parse(run.value);
  return { items: questions.slice(0, count), provider: run.provider };
}

// ---------------------------------------------------------------------------
// Demo material — returned only when AI_DEMO_MODE=true.
// Deterministic and obviously fake so it's never mistaken for real output.
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
      back: 'Set GEMINI_API_KEY (or DEEPSEEK_API_KEY) and AI_DEMO_MODE=false.',
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
      explanation: 'Configure GEMINI_API_KEY or DEEPSEEK_API_KEY, demo off.',
    },
  ];
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}
