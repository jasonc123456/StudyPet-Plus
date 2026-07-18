import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { deleteOwnedQuiz, QuizServiceError } from '@/lib/quizzes';

// Delete a quiz the user no longer wants. Keeping the quiz (and retaking it) is
// the default — this is the explicit opt-out. Child questions/attempts cascade.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    await deleteOwnedQuiz(params.id, authResult.user.id);
    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof QuizServiceError) {
      return jsonError(error.message, 404);
    }
    console.error('DELETE /api/quizzes/[id]', error);
    return jsonError('Failed to delete quiz', 500);
  }
}
