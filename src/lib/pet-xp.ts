// Pet XP persistence (US-3.6) — server-only helpers.

import {
  derivePetLevelAndStage,
  FLASHCARD_REVIEW_XP,
} from '@/lib/pet-xp.constants';
import { prisma } from '@/lib/prisma';
import { Prisma, type Pet } from '@prisma/client';

export {
  derivePetLevelAndStage,
  FLASHCARD_REVIEW_XP,
  PET_STAGE_KEYS,
  PET_STAGE_XP_THRESHOLDS,
  xpForFlashcardReview,
  type FlashcardReviewOutcome,
  type PetXpAction,
} from '@/lib/pet-xp.constants';

/** Persist an XP grant and refresh level/stage from the new total. */
export async function awardPetXp(userId: string, amount: number): Promise<Pet> {
  if (amount <= 0) {
    const existing = await prisma.pet.findUnique({ where: { userId } });
    if (existing) return existing;
    return prisma.pet.create({
      data: {
        userId,
        name: 'StudyPet',
        xp: 0,
      },
    });
  }

  const pet = await prisma.pet.upsert({
    where: { userId },
    update: {
      xp: { increment: amount },
      lastStudyDate: new Date(),
    },
    create: {
      userId,
      name: 'StudyPet',
      xp: amount,
      lastStudyDate: new Date(),
    },
  });

  const { level, stage } = derivePetLevelAndStage(pet.xp);
  if (level === pet.level && stage === pet.stage) {
    return pet;
  }

  return prisma.pet.update({
    where: { id: pet.id },
    data: { level, stage },
  });
}

/** UTC calendar day ("YYYY-MM-DD") — the anti-farming granularity for review XP. */
function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export type FlashcardReviewAwardResult = {
  pet: Pet;
  awarded: boolean;
  xp: number;
};

/**
 * Grant flashcard-review XP for one card, at most once per user per card per UTC
 * day. The `FlashcardReviewAward` unique key is the source of truth: a duplicate
 * insert (re-marking the same card in this session, after a reload, or on a repeat
 * pass) throws P2002 and yields no XP, so the payout can't be farmed. A genuine
 * review on a later day inserts a new row and earns again. Cards the caller does
 * not own are ignored. Never awards for cards that don't belong to the user.
 */
export async function awardFlashcardReviewXp(
  userId: string,
  flashcardId: string
): Promise<FlashcardReviewAwardResult> {
  const owned = await prisma.flashcard.findFirst({
    where: { id: flashcardId, userId },
    select: { id: true },
  });
  if (!owned) {
    return { pet: await awardPetXp(userId, 0), awarded: false, xp: 0 };
  }

  try {
    await prisma.flashcardReviewAward.create({
      data: {
        userId,
        flashcardId,
        awardedOn: utcDayKey(),
        xp: FLASHCARD_REVIEW_XP,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Already rewarded this card today — return the current pet, no XP.
      return { pet: await awardPetXp(userId, 0), awarded: false, xp: 0 };
    }
    throw error;
  }

  const pet = await awardPetXp(userId, FLASHCARD_REVIEW_XP);
  return { pet, awarded: true, xp: FLASHCARD_REVIEW_XP };
}
