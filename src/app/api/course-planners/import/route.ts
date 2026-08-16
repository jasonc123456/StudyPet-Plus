import { NextResponse } from 'next/server';

import { AiBudgetError, claimAiGeneration } from '@/lib/ai/entitlement';
import { AiProviderError } from '@/lib/ai/provider';
import { parseCoursePlanText } from '@/lib/ai/planner-import';
import { streamGeneration } from '@/lib/ai/sse';
import { jsonError, requireUser } from '@/lib/api-response';
import { issueImportDraft } from '@/lib/import-draft';
import { getOwnedCoursePlanner } from '@/lib/planner';
import {
  parseCoursePlannerImportSchema,
  zodFirstError,
} from '@/lib/validators';

/**
 * POST /api/course-planners/import
 *
 * Parse pasted / CSV plan text into a draft. Does not write to the database —
 * the client must call /api/course-planners/import/confirm after preview.
 * Incoming text is validated + sanitized server-side (never trust the client).
 *
 * Auth / validation failures return ordinary JSON so the client can surface a
 * proper error before any stream starts. Once parsing begins the response is an
 * SSE stream (like flashcards / quizzes) so the UI can show live progress —
 * a self-hosted reasoning model can take a while on a complex plan.
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

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    typeof (body as { text?: unknown }).text !== 'string'
  ) {
    return jsonError('Plan text must be a string', 400);
  }

  const parsed = parseCoursePlannerImportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const planner = await getOwnedCoursePlanner(
    parsed.data.plannerId,
    authResult.user.id
  );
  if (!planner) {
    return jsonError('Planner not found', 404);
  }

  let claim;
  try {
    claim = await claimAiGeneration(authResult.user.id);
  } catch (error) {
    if (error instanceof AiBudgetError) {
      return jsonError(error.message, 429, {
        'Retry-After': String(error.retryAfterSeconds),
      });
    }
    throw error;
  }

  return streamGeneration(async (emit) => {
    try {
      const result = await parseCoursePlanText(
        parsed.data.text,
        (p) => emit({ type: 'progress', ...p }),
        claim.entitlement.demoOnly
      );

      if (result.draft.sections.length === 0) {
        emit({ type: 'error', message: 'No courses detected.' });
        return;
      }

      // The confirmation step spends this, so one parse authorises one save.
      const draftToken = await issueImportDraft(authResult.user.id, planner.id);

      emit({
        type: 'done',
        result: {
          draft: result.draft,
          draftToken,
          provider: result.provider,
          stats: result.stats,
        },
      });
    } catch (error) {
      emitPlannerImportError(emit, error);
    } finally {
      claim.release();
    }
  });
}

function emitPlannerImportError(
  emit: (event: { type: 'error'; message: string }) => void,
  error: unknown
) {
  if (error instanceof AiProviderError) {
    console.error(
      '[ai] POST /api/course-planners/import',
      error.message.slice(0, 300)
    );
    emit({ type: 'error', message: error.message });
    return;
  }
  if (error instanceof Error) {
    if (/no courses detected/i.test(error.message)) {
      emit({ type: 'error', message: 'No courses detected.' });
      return;
    }
    emit({ type: 'error', message: error.message });
    return;
  }
  console.error('POST /api/course-planners/import', error);
  emit({ type: 'error', message: 'Failed to parse course plan' });
}
