import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { awardPetXp, xpForFlashcardReview } from '@/lib/pet-xp';
import { awardPetXpSchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = awardPetXpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { action, outcome } = parsed.data;

  const xpAwarded =
    action === 'flashcard_review' ? xpForFlashcardReview(outcome) : 0;

  const pet = await awardPetXp(authResult.user.id, xpAwarded);

  return jsonOk({
    pet: {
      id: pet.id,
      name: pet.name,
      xp: pet.xp,
      level: pet.level,
      stage: pet.stage,
      streakCount: pet.streakCount,
    },
    xpAwarded,
    action,
    outcome,
  });
}
