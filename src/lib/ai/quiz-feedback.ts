/**
 * AI-powered tutor feedback for quiz hints and answer explanations.
 *
 * Used live (Review/Practice after answer, Practice hints, Exam after submit)
 * with a deterministic fallback when the model is unavailable.
 */

import { AI_NOT_CONFIGURED_MESSAGE, getAiRuntimeStatus } from '@/lib/ai/config';
import {
  AiProviderError,
  hasConfiguredProvider,
  runWithFallback,
  type JsonPrompt,
} from '@/lib/ai/provider';
import type { AiProviderName } from '@/lib/ai/types';
import {
  buildFallbackTutorFeedback,
  type TutorFeedback,
} from '@/lib/quiz-explanation';
import { z } from 'zod';

export const tutorFeedbackSchema = z.object({
  hint: z.string().trim().min(1).max(320),
  whyCorrect: z.string().trim().min(1).max(450),
  whySelectedMisses: z.string().trim().max(450).nullable(),
  conceptToReview: z.string().trim().min(1).max(120),
  reviewNextReason: z.string().trim().min(1).max(400),
});

export type TutorFeedbackPayload = z.infer<typeof tutorFeedbackSchema>;

const tutorFeedbackBatchSchema = z.object({
  items: z.array(tutorFeedbackSchema).min(1).max(20),
});

export type QuizFeedbackItemInput = {
  /** Optional client id for matching batch responses. */
  id?: string;
  question: string;
  choices: string[];
  selectedAnswer?: string | null;
  correctAnswer: string;
  topic?: string | null;
  /** null when the learner has not answered yet (hint-only). */
  correct?: boolean | null;
  purpose?: 'hint' | 'feedback' | 'both';
};

export type GenerateQuizFeedbackInput = {
  items: QuizFeedbackItemInput[];
  mode: 'review' | 'practice' | 'exam';
  sourceSnippet?: string | null;
  /**
   * Serve canned feedback and never call a provider, regardless of AI_DEMO_MODE.
   * Set for the shared public demo account — see src/lib/ai/entitlement.ts.
   */
  demoOnly?: boolean;
};

export type QuizFeedbackItemResult = {
  id?: string;
  feedback: TutorFeedback;
  provider: AiProviderName;
  fromFallback: boolean;
};

function clip(text: string | null | undefined, max: number): string {
  return (text ?? '').trim().slice(0, max);
}

function feedbackPrompt(input: GenerateQuizFeedbackInput): JsonPrompt {
  const snippet = clip(input.sourceSnippet, 2500);
  const itemsJson = input.items.map((item, index) => ({
    index,
    id: item.id ?? null,
    purpose: item.purpose ?? 'feedback',
    topic: item.topic ?? null,
    question: clip(item.question, 500),
    choices: item.choices.map((c) => clip(c, 300)),
    selectedAnswer: item.selectedAnswer ?? null,
    correctAnswer: clip(item.correctAnswer, 300),
    answeredCorrectly:
      item.correct === null || item.correct === undefined ? null : item.correct,
  }));

  return {
    system:
      'You are a concise AI tutor. Return JSON only. Use short sentences. ' +
      'Explain concepts with reasoning and practical intuition. Never cite notes ' +
      'as the reason. Banned phrases: "the notes say", "the source states", ' +
      '"source material identifies", "common mix-up", "concept this question is testing", ' +
      '"that is why this is the best choice". Hints must not reveal the correct answer.',
    user:
      `Write tutor feedback for ${itemsJson.length} quiz item(s). Mode: ${input.mode}.\n` +
      'Return JSON of the exact shape:\n' +
      '{ "items": [ { "hint": string, "whyCorrect": string, "whySelectedMisses": string|null, ' +
      '"conceptToReview": string, "reviewNextReason": string } ] }\n' +
      'Rules per item:\n' +
      '- hint: one short nudge. Do not name the correct choice.\n' +
      '- whyCorrect: 1–2 short sentences on why the correct answer makes sense.\n' +
      '- whySelectedMisses: 1–2 short sentences comparing the selected wrong answer ' +
      'to the correct idea; null if unanswered or correct.\n' +
      '- conceptToReview: short topic name.\n' +
      '- reviewNextReason: short practical next-step reason (especially if wrong).\n' +
      '- Prefer plain language and comparisons (selected vs correct).\n' +
      '- Keep every field concise. No run-on sentences.\n' +
      (snippet
        ? `\nOptional grounding context (do not cite it):\n"""${snippet}"""\n`
        : '') +
      `\nItems:\n${JSON.stringify(itemsJson)}`,
  };
}

function toTutorFeedback(
  payload: TutorFeedbackPayload,
  fallbackTopic: string | null | undefined
): TutorFeedback {
  return {
    hint: payload.hint.trim(),
    whyCorrect: payload.whyCorrect.trim(),
    whySelectedMisses: payload.whySelectedMisses?.trim() || null,
    conceptToReview:
      payload.conceptToReview.trim() || fallbackTopic?.trim() || 'This topic',
    reviewNextReason: payload.reviewNextReason.trim(),
  };
}

function fallbackResults(
  input: GenerateQuizFeedbackInput,
  provider: AiProviderName
): QuizFeedbackItemResult[] {
  return input.items.map((item) => ({
    id: item.id,
    feedback: buildFallbackTutorFeedback({
      question: item.question,
      choices: item.choices,
      selectedAnswer: item.selectedAnswer ?? null,
      correctAnswer: item.correctAnswer,
      topic: item.topic,
      correct: item.correct ?? null,
      purpose: item.purpose ?? 'feedback',
    }),
    provider,
    fromFallback: true,
  }));
}

/**
 * Generate tutor-style hint/explanation feedback for one or more quiz items.
 * Never throws for provider failures — returns deterministic fallback instead.
 */
export async function generateQuizFeedback(
  input: GenerateQuizFeedbackInput
): Promise<QuizFeedbackItemResult[]> {
  const items = input.items.slice(0, 20);
  if (items.length === 0) return [];

  const normalized: GenerateQuizFeedbackInput = {
    ...input,
    items,
    sourceSnippet: clip(input.sourceSnippet, 2500) || null,
  };

  const status = getAiRuntimeStatus();
  if (status.demoMode || input.demoOnly) {
    return fallbackResults(normalized, 'demo');
  }

  if (!hasConfiguredProvider()) {
    console.warn('[ai] generateQuizFeedback missing providers', {
      geminiConfigured: status.geminiConfigured,
      localConfigured: status.localConfigured,
    });
    return fallbackResults(normalized, 'gemini');
  }

  try {
    const run = await runWithFallback(
      feedbackPrompt(normalized),
      (value) => tutorFeedbackBatchSchema.safeParse(value).success
    );
    const parsed = tutorFeedbackBatchSchema.parse(run.value);
    const count = Math.min(parsed.items.length, normalized.items.length);

    // Prefer AI items; fill any missing slots with fallback.
    const results: QuizFeedbackItemResult[] = [];
    for (let i = 0; i < normalized.items.length; i += 1) {
      const item = normalized.items[i]!;
      const aiItem = i < count ? parsed.items[i] : null;
      if (aiItem) {
        results.push({
          id: item.id,
          feedback: toTutorFeedback(aiItem, item.topic),
          provider: run.provider,
          fromFallback: false,
        });
      } else {
        results.push(
          ...fallbackResults({ ...normalized, items: [item] }, run.provider)
        );
      }
    }
    return results;
  } catch (error) {
    const message =
      error instanceof AiProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : AI_NOT_CONFIGURED_MESSAGE;
    console.warn('[ai] generateQuizFeedback falling back', message);
    return fallbackResults(normalized, 'gemini');
  }
}

/** Convenience for a single item. */
export async function generateSingleQuizFeedback(
  item: QuizFeedbackItemInput,
  mode: GenerateQuizFeedbackInput['mode'],
  sourceSnippet?: string | null
): Promise<QuizFeedbackItemResult> {
  const [result] = await generateQuizFeedback({
    items: [item],
    mode,
    sourceSnippet,
  });
  return (
    result ?? {
      id: item.id,
      feedback: buildFallbackTutorFeedback({
        question: item.question,
        choices: item.choices,
        selectedAnswer: item.selectedAnswer ?? null,
        correctAnswer: item.correctAnswer,
        topic: item.topic,
        correct: item.correct ?? null,
        purpose: item.purpose ?? 'feedback',
      }),
      provider: 'demo',
      fromFallback: true,
    }
  );
}
