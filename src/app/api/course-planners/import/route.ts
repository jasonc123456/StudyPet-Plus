import { NextResponse } from 'next/server';

import { AiProviderError } from '@/lib/ai/provider';
import { parseCoursePlanText } from '@/lib/ai/planner-import';
import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
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

  try {
    const result = await parseCoursePlanText(parsed.data.text);

    if (result.draft.sections.length === 0) {
      return jsonError('No courses detected.', 422);
    }

    return jsonOk({
      draft: result.draft,
      provider: result.provider,
      stats: result.stats,
    });
  } catch (error) {
    if (error instanceof AiProviderError) {
      return jsonError(error.message, 503);
    }
    if (error instanceof Error) {
      const message = error.message;
      if (/no courses detected/i.test(message)) {
        return jsonError('No courses detected.', 422);
      }
      return jsonError(message, 400);
    }
    console.error('POST /api/course-planners/import', error);
    return jsonError('Failed to parse course plan', 500);
  }
}
