import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { recordStudyActivity } from '@/lib/pet-xp';
import { recordStudyActivitySchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = recordStudyActivitySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const pet = await recordStudyActivity(authResult.user.id);

  return jsonOk({
    pet: {
      id: pet.id,
      name: pet.name,
      xp: pet.xp,
      level: pet.level,
      stage: pet.stage,
      streakCount: pet.streakCount,
    },
    action: parsed.data.action,
  });
}
