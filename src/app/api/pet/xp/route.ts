import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { awardFlashcardReviewXp, recordStudyActivity } from '@/lib/pet-xp';
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

  const { action, outcome, cardId } = parsed.data;

  // Only a "known" mark earns XP, and the award is deduped server-side to at
  // most once per card per day (see awardFlashcardReviewXp). An "unknown" mark
  // just returns the current pet so the client stays in sync.
  const { pet, xp: xpAwarded } =
    action === 'flashcard_review' && outcome === 'known'
      ? await awardFlashcardReviewXp(authResult.user.id, cardId)
      : { pet: await recordStudyActivity(authResult.user.id), xp: 0 };

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
