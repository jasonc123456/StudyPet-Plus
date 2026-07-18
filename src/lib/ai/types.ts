// Shared types + Zod schemas for AI-generated study material (US-3.2).
//
// These are the contract US-3.3 (flashcards) and US-3.4 (quizzes) build on:
// every provider must ultimately produce data that validates against the
// schemas here, so the rest of the app can trust the shape regardless of which
// model (Gemini, DeepSeek, or the demo stub) actually served it.

import { z } from 'zod';

/** Which backend produced a result — handy for logging + the UI "demo" badge. */
export type AiProviderName = 'local' | 'gemini' | 'deepseek' | 'demo';

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/** One flashcard. Mirrors the demo card shape in components/FlashcardDemo.tsx. */
export const flashcardSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  front: z.string().trim().min(1).max(500),
  back: z.string().trim().min(1).max(1000),
});

export type Flashcard = z.infer<typeof flashcardSchema>;

/** The object we ask the model to return (json_object mode can't return a bare array). */
export const flashcardResponseSchema = z.object({
  cards: z.array(flashcardSchema).min(1),
});

// ---------------------------------------------------------------------------
// Quizzes (multiple choice)
// ---------------------------------------------------------------------------

export const quizQuestionSchema = z
  .object({
    topic: z.string().trim().min(1).max(80),
    question: z.string().trim().min(1).max(500),
    choices: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
    // 0-based index into `choices`.
    answerIndex: z.number().int().min(0),
    explanation: z.string().trim().max(1000).optional(),
  })
  .refine((q) => q.answerIndex < q.choices.length, {
    message: 'answerIndex must point at one of the choices',
    path: ['answerIndex'],
  });

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1),
});

// ---------------------------------------------------------------------------
// Public request/response shapes
// ---------------------------------------------------------------------------

export interface GenerateFlashcardsInput {
  /** Source study text — typically a Note's content. */
  sourceText: string;
  /** How many cards to aim for. Clamped to a sane range. */
  count?: number;
  /** Optional subject/course name to bias topic tagging. */
  topicHint?: string;
}

export interface GenerateQuizInput {
  sourceText: string;
  count?: number;
  topicHint?: string;
}

/** Result wrapper so callers know which provider answered (real vs. demo). */
export interface AiResult<T> {
  items: T[];
  provider: AiProviderName;
}
