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

export type PetXpAction = 'flashcard_review' | 'quiz_session';

export type FlashcardReviewOutcome = 'known' | 'unknown';

export function xpForFlashcardReview(outcome: FlashcardReviewOutcome): number {
  return outcome === 'known' ? FLASHCARD_REVIEW_XP : 0;
}

/**
 * Score-tiered XP for completing a quiz (US-4.05). The top tier matches the
 * StudyPetHero "Take quiz" payout of 15 XP; weaker scores still earn something
 * so finishing a quiz always feels rewarding.
 */
export const QUIZ_COMPLETION_XP_TIERS = [
  { minScorePercent: 90, xp: 15 },
  { minScorePercent: 75, xp: 12 },
  { minScorePercent: 60, xp: 9 },
  { minScorePercent: 0, xp: 6 },
] as const;

export function xpForQuizScore(
  correctCount: number,
  totalQuestions: number
): number {
  if (totalQuestions <= 0) return 0;

  const percent = Math.round((correctCount / totalQuestions) * 100);
  const tier = QUIZ_COMPLETION_XP_TIERS.find(
    (candidate) => percent >= candidate.minScorePercent
  );
  return tier?.xp ?? 0;
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
