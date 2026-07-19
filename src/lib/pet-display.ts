import {
  getPetStage,
  type PetStage,
  PET_STAGE_LEVELS,
} from '@/lib/pet-progress';
import { normalizePetStageKey } from '@/lib/pet-xp.constants';

export type PetStageDisplay = {
  key: string;
  label: string;
  subtitle: string;
  avatarSize: number;
};

const PET_STAGE_DISPLAY: Record<string, PetStageDisplay> = {
  egg: {
    key: 'egg',
    label: 'Egg',
    subtitle: 'A tiny companion is getting ready to hatch.',
    avatarSize: 136,
  },
  hatchling: {
    key: 'hatchling',
    label: 'Hatchling',
    subtitle: 'A brand-new friend is peeking out and learning to trust you.',
    avatarSize: 148,
  },
  baby: {
    key: 'baby',
    label: 'Baby',
    subtitle: 'Your StudyPet is playful, curious, and gaining confidence.',
    avatarSize: 160,
  },
  toddler: {
    key: 'toddler',
    label: 'Toddler',
    subtitle: 'Curious, playful, and growing with every study session.',
    avatarSize: 164,
  },
  teen: {
    key: 'teen',
    label: 'Teen',
    subtitle: 'Confident enough to tackle bigger study challenges.',
    avatarSize: 180,
  },
  adult: {
    key: 'adult',
    label: 'Adult',
    subtitle: 'A steady study partner with real momentum.',
    avatarSize: 196,
  },
  beast: {
    key: 'beast',
    label: 'Beast',
    subtitle: 'Peak StudyPet form: focused, fierce, and unstoppable.',
    avatarSize: 214,
  },
};

export function getPetStageDisplay(stage: string, xp = 0): PetStageDisplay {
  const normalizedStage = normalizePetStageKey(stage, xp);

  return (
    PET_STAGE_DISPLAY[normalizedStage] ?? {
      key: normalizedStage,
      label: normalizedStage || 'Unknown',
      subtitle: 'Keep studying to discover the next evolution.',
      avatarSize: 150,
    }
  );
}

export function getNextPetMilestone(xp: number, stage: string) {
  const normalizedStage = normalizePetStageKey(stage, xp);
  const currentStageIndex = PET_STAGE_LEVELS.findIndex(
    (stageInfo) => stageInfo.stage === normalizedStage
  );
  const nextThreshold =
    PET_STAGE_LEVELS[currentStageIndex + 1]?.minLevel ?? null;
  const currentLevelRange = PET_STAGE_LEVELS[currentStageIndex];
  const currentStageMaxLevel =
    currentLevelRange?.maxLevel ??
    nextThreshold ??
    currentLevelRange?.minLevel ??
    0;
  const currentLevel =
    PET_STAGE_LEVELS.find((stageInfo) => stageInfo.stage === normalizedStage)
      ?.minLevel ?? 0;
  const progressPercent =
    nextThreshold === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((currentLevel - (currentLevelRange?.minLevel ?? 0) + 1) /
              Math.max(
                1,
                currentStageMaxLevel - (currentLevelRange?.minLevel ?? 0) + 1
              )) *
              100
          )
        );

  return {
    normalizedStage,
    nextThreshold,
    xpRemaining: nextThreshold ? Math.max(0, nextThreshold - currentLevel) : 0,
    progressPercent,
  };
}
