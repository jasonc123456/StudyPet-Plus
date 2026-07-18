import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getQuizAnalytics } from '@/lib/quiz-analytics';
import { QuizServiceError, submitQuizAttempt } from '@/lib/quizzes';
import { submitQuizAttemptSchema, zodFirstError } from '@/lib/validators';

// US-4.02 — past attempts + per-topic analytics are retrievable via API.
export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const analytics = await getQuizAnalytics(authResult.user.id);
    return jsonOk(analytics);
  } catch (error) {
    console.error('GET /api/quizzes/attempts', error);
    return jsonError('Failed to load quiz analytics', 500);
  }
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
