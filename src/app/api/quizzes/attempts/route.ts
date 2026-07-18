import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { QuizServiceError, submitQuizAttempt } from '@/lib/quizzes';
import { submitQuizAttemptSchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = submitQuizAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  try {
    const result = await submitQuizAttempt({
      userId: authResult.user.id,
      quizId: parsed.data.quizId,
      clientAttemptId: parsed.data.clientAttemptId,
      answers: parsed.data.answers,
    });

    return jsonOk(result, 201);
  } catch (error) {
    if (error instanceof QuizServiceError) {
      if (error.code === 'NOT_FOUND') {
        return jsonError(error.message, 404);
      }

      return jsonError(error.message, 400);
    }

    console.error('POST /api/quizzes/attempts', error);
    return jsonError('Failed to save quiz attempt', 500);
  }
}
