// Pet XP persistence (US-3.6) — server-only helpers.

import {
  derivePetLevelAndStage,
  xpForFlashcardReview,
} from '@/lib/pet-xp.constants';
import { prisma } from '@/lib/prisma';
import type { Pet } from '@prisma/client';

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
