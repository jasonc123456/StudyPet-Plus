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
// Streaming progress
// ---------------------------------------------------------------------------
//
// Reasoning models (e.g. Qwen3 on the self-hosted server) "think" before they
// emit the answer. The provider surfaces that as two phases so the UI can show
// honest, live progress instead of a static spinner:
//   - "thinking": the model is reasoning; no output items exist yet.
//   - "writing":  the JSON answer is streaming in.
// Counters are cumulative character counts — enough to prove the stream is
// moving without promising a predictable total (generation length is unknown).

export type AiProgressPhase = 'thinking' | 'writing';

export interface AiProgressEvent {
  phase: AiProgressPhase;
  /** Cumulative reasoning characters streamed so far. */
  thinkingChars: number;
  /** Cumulative answer characters streamed so far. */
  writingChars: number;
}

export type AiProgressCallback = (event: AiProgressEvent) => void;

// ---------------------------------------------------------------------------
// Binary attachments (PDF passthrough)
// ---------------------------------------------------------------------------
//
// A source note can carry a PDF attachment. When such a note is chosen for
// generation, the raw file is passed straight to the model (rather than
// extracted server-side) so it decides how to read it. Only reaches a provider
// at generation time — never on upload.

export interface AiAttachment {
  /** Display name, e.g. "lecture-3.pdf". */
  filename: string;
  /** MIME type, e.g. "application/pdf". */
  mimeType: string;
  /** Raw file bytes, base64-encoded (no `data:` prefix). */
  base64: string;
}

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
    explanation: z.string().trim().max(1500).optional(),
    /**
     * Optional contrast for a likely wrong choice. Not stored as its own DB
     * column — merged into `explanation` on save.
     */
    misconception: z.string().trim().max(800).optional(),
    /**
     * Parallel to `choices`: for each wrong option a short "why this is
     * incorrect", empty string at the correct index. Precomputed here so
     * completing a quiz needs no live AI call. Length is normalized to
     * `choices.length` on save; a missing/short array degrades to fallback text.
     */
    choiceRationales: z.array(z.string().trim().max(400)).optional(),
    // A nudge toward the answer without giving it away.
    hint: z.string().trim().min(1).max(500),
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
  /** Source study text — typically a Note's content. May be empty when attachments carry the source. */
  sourceText: string;
  /** How many cards to aim for. Clamped to a sane range. */
  count?: number;
  /** Optional subject/course name to bias topic tagging. */
  topicHint?: string;
  /** Raw file attachments (e.g. PDFs) passed through to the model. */
  attachments?: AiAttachment[];
  /** Optional live progress callback (enables streaming when supported). */
  onProgress?: AiProgressCallback;
}

export interface GenerateQuizInput {
  sourceText: string;
  count?: number;
  topicHint?: string;
  /** Raw file attachments (e.g. PDFs) passed through to the model. */
  attachments?: AiAttachment[];
  /** Optional live progress callback (enables streaming when supported). */
  onProgress?: AiProgressCallback;
}

/** Result wrapper so callers know which provider answered (real vs. demo). */
export interface AiResult<T> {
  items: T[];
  provider: AiProviderName;
}
