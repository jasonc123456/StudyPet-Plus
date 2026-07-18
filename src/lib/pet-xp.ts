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

const STREAK_RESET_MS = 24 * 60 * 60 * 1000;

type PetActivityDbClient = Pick<typeof prisma, 'pet' | 'user'>;

function studyDayKey(date: Date, timeZone?: string | null): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function deriveNextStreakCount(args: {
  lastStudyDate: Date | null;
  streakCount: number;
  now: Date;
  timeZone?: string | null;
}) {
  const { lastStudyDate, streakCount, now, timeZone } = args;

  if (!lastStudyDate) {
    return 1;
  }

  const elapsed = now.getTime() - lastStudyDate.getTime();
  if (elapsed > STREAK_RESET_MS) {
    return 1;
  }

  if (studyDayKey(lastStudyDate, timeZone) === studyDayKey(now, timeZone)) {
    return Math.max(streakCount, 1);
  }

  return Math.max(streakCount, 0) + 1;
}

export function getVisibleStreakCount(args: {
  lastStudyDate: Date | null;
  streakCount: number;
  now?: Date;
}) {
  const { lastStudyDate, streakCount, now = new Date() } = args;

  if (!lastStudyDate) {
    return 0;
  }

  return now.getTime() - lastStudyDate.getTime() > STREAK_RESET_MS
    ? 0
    : streakCount;
}

/**
 * Persist a study activity and optionally award XP. The streak increments at
 * most once per study day and resets to 0 in the dashboard after 24 hours of
 * inactivity. A later activity starts a fresh streak at 1.
 */
export async function recordStudyActivity(
  userId: string,
  options?: {
    xp?: number;
    client?: PetActivityDbClient;
  }
): Promise<Pet> {
  const db = options?.client ?? prisma;
  const xp = Math.max(0, options?.xp ?? 0);
  const now = new Date();

  const [pet, user] = await Promise.all([
    db.pet.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        xp: true,
        level: true,
        stage: true,
        streakCount: true,
        lastStudyDate: true,
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);

  const nextXp = (pet?.xp ?? 0) + xp;
  const nextStreakCount = deriveNextStreakCount({
    lastStudyDate: pet?.lastStudyDate ?? null,
    streakCount: pet?.streakCount ?? 0,
    now,
    timeZone: user?.timezone ?? null,
  });
  const { level, stage } = derivePetLevelAndStage(nextXp);

  return db.pet.upsert({
    where: { userId },
    update: {
      xp: nextXp,
      level,
      stage,
      streakCount: nextStreakCount,
      lastStudyDate: now,
    },
    create: {
      userId,
      name: 'StudyPet',
      xp: nextXp,
      level,
      stage,
      streakCount: nextStreakCount,
      lastStudyDate: now,
    },
  });
}

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

  return recordStudyActivity(userId, { xp: amount });
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
    return { pet: await recordStudyActivity(userId), awarded: false, xp: 0 };
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
      return { pet: await recordStudyActivity(userId), awarded: false, xp: 0 };
    }
    throw error;
  }

  const pet = await recordStudyActivity(userId, { xp: FLASHCARD_REVIEW_XP });
  return { pet, awarded: true, xp: FLASHCARD_REVIEW_XP };
}
