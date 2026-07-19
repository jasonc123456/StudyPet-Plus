import { NextResponse } from 'next/server';

import { generateQuizFeedback } from '@/lib/ai/quiz-feedback';
import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { quizFeedbackRequestSchema, zodFirstError } from '@/lib/validators';

/**
 * POST /api/quizzes/feedback
 *
 * AI tutor hints/explanations for Review / Practice / Exam.
 * Auth required. Falls back to deterministic concise text if AI fails.
 */
export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = quizFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  try {
    const results = await generateQuizFeedback({
      mode: parsed.data.mode,
      sourceSnippet: parsed.data.sourceSnippet,
      items: parsed.data.items.map((item) => ({
        id: item.id,
        question: item.question,
        choices: item.choices,
        selectedAnswer: item.selectedAnswer ?? null,
        correctAnswer: item.correctAnswer,
        topic: item.topic ?? null,
        correct: item.correct ?? null,
        purpose: item.purpose ?? 'feedback',
      })),
    });

    return jsonOk({
      items: results.map((result) => ({
        id: result.id ?? null,
        fromFallback: result.fromFallback,
        provider: result.provider,
        feedback: result.feedback,
      })),
    });
  } catch (error) {
    console.error('POST /api/quizzes/feedback', error);
    return jsonError('Failed to generate quiz feedback', 500);
  }
}
