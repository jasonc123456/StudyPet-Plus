import { NextResponse } from 'next/server';

import { AiProviderError } from '@/lib/ai/provider';
import { streamGeneration } from '@/lib/ai/sse';
import { jsonError, requireUser } from '@/lib/api-response';
import { generateAndSaveQuiz, QuizServiceError } from '@/lib/quizzes';
import {
  generateQuizRequestSchema,
  resolveNoteIds,
  zodFirstError,
} from '@/lib/validators';

/** Friendly message for an AI failure surfaced as an SSE `error` event. */
function aiErrorMessage(error: AiProviderError): string {
  const notConfigured = /not configured|GEMINI_API_KEY|LOCAL_AI/i.test(
    error.message
  );
  return notConfigured
    ? 'AI generation is not configured on the server.'
    : 'Quiz generation failed. The AI provider timed out or returned an invalid response. Please try again.';
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = generateQuizRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { title, count } = parsed.data;
  const noteIds = resolveNoteIds(parsed.data);
  const userId = authResult.user.id;

  // Everything below streams as SSE: progress events while the model works,
  // then a single `done` (with the saved payload) or `error` event.
  return streamGeneration(async (emit) => {
    try {
      const result = await generateAndSaveQuiz({
        noteIds,
        userId,
        title,
        count,
        onProgress: (p) => emit({ type: 'progress', ...p }),
      });
      emit({ type: 'done', result });
    } catch (error) {
      if (error instanceof QuizServiceError) {
        emit({ type: 'error', message: error.message });
        return;
      }
      if (error instanceof AiProviderError) {
        console.error(
          '[ai] POST /api/quizzes/generate',
          error.message.slice(0, 300)
        );
        emit({ type: 'error', message: aiErrorMessage(error) });
        return;
      }
      console.error('POST /api/quizzes/generate', error);
      emit({ type: 'error', message: 'Failed to generate quiz.' });
    }
  });
}
