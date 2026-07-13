/** XP for marking a flashcard as known during review (StudyPetHero: "Review card"). */
export const FLASHCARD_REVIEW_XP = 6;

export const PET_STAGE_KEYS = [
  'egg',
  'hatchling',
  'chick',
  'owl',
  'dragon',
] as const;

/** XP required to reach each stage (index-aligned with PET_STAGE_KEYS). */
export const PET_STAGE_XP_THRESHOLDS = [0, 90, 200, 500, 1000] as const;

export type PetXpAction = 'flashcard_review';

export type FlashcardReviewOutcome = 'known' | 'unknown';

export function xpForFlashcardReview(outcome: FlashcardReviewOutcome): number {
  return outcome === 'known' ? FLASHCARD_REVIEW_XP : 0;
}

export function derivePetLevelAndStage(xp: number): {
  level: number;
  stage: string;
} {
  let stageIndex = 0;
  for (let i = 0; i < PET_STAGE_XP_THRESHOLDS.length; i++) {
    if (xp >= PET_STAGE_XP_THRESHOLDS[i]) {
      stageIndex = i;
    }
  }

  return {
    level: stageIndex + 1,
    stage: PET_STAGE_KEYS[stageIndex],
  };
}
