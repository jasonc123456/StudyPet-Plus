export const PET_XP_BASE = 100;
export const PET_XP_GROWTH_RATE = 1.5;

export const PET_STAGE_LEVELS = [
  { stage: 'egg', label: 'Egg', minLevel: 0, maxLevel: 2 },
  { stage: 'hatchling', label: 'Hatchling', minLevel: 3, maxLevel: 5 },
  { stage: 'baby', label: 'Baby', minLevel: 6, maxLevel: 10 },
  { stage: 'toddler', label: 'Toddler', minLevel: 11, maxLevel: 18 },
  { stage: 'teen', label: 'Teen', minLevel: 19, maxLevel: 30 },
  { stage: 'adult', label: 'Adult', minLevel: 31, maxLevel: 50 },
  { stage: 'beast', label: 'Beast', minLevel: 51, maxLevel: null },
] as const;

export type PetStage = (typeof PET_STAGE_LEVELS)[number]['stage'];

export type PetStageInfo = {
  stage: PetStage;
  stageName: string;
  evolutionProgress: number;
  nextStageLevelThreshold: number | null;
};

export type XpProgress = {
  percentage: number;
  xpNeededForNextLevel: number;
  currentLevelFloorXp: number;
  nextLevelXp: number;
};

export function getXpRequired(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  return Math.floor(
    PET_XP_BASE * Math.pow(normalizedLevel, PET_XP_GROWTH_RATE)
  );
}

export function getTotalXpForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));

  let total = 0;
  for (
    let currentLevel = 1;
    currentLevel < normalizedLevel;
    currentLevel += 1
  ) {
    total += getXpRequired(currentLevel);
  }

  return total;
}

export function getLevelFromXp(currentXp: number): number {
  const normalizedXp = Math.max(0, Math.floor(currentXp));
  let level = 1;
  let totalSpent = 0;

  while (normalizedXp >= totalSpent + getXpRequired(level)) {
    totalSpent += getXpRequired(level);
    level += 1;
  }

  return level;
}

export function getProgress(currentXp: number, level: number): XpProgress {
  const normalizedLevel = Math.max(1, Math.floor(level));
  const normalizedXp = Math.max(0, Math.floor(currentXp));
  const currentLevelFloorXp = getTotalXpForLevel(normalizedLevel);
  const nextLevelXp = currentLevelFloorXp + getXpRequired(normalizedLevel);
  const levelSpan = Math.max(1, nextLevelXp - currentLevelFloorXp);
  const percentage = Math.max(
    0,
    Math.min(100, ((normalizedXp - currentLevelFloorXp) / levelSpan) * 100)
  );

  return {
    percentage,
    xpNeededForNextLevel: Math.max(0, nextLevelXp - normalizedXp),
    currentLevelFloorXp,
    nextLevelXp,
  };
}

export function getPetStage(level: number): PetStageInfo {
  const normalizedLevel = Math.max(0, Math.floor(level));
  const currentStage =
    PET_STAGE_LEVELS.find((stageInfo) => {
      const maxLevel = stageInfo.maxLevel ?? Number.POSITIVE_INFINITY;
      return (
        normalizedLevel >= stageInfo.minLevel && normalizedLevel <= maxLevel
      );
    }) ?? PET_STAGE_LEVELS[PET_STAGE_LEVELS.length - 1];

  const nextStage = PET_STAGE_LEVELS.find(
    (stageInfo) => stageInfo.minLevel > normalizedLevel
  );
  const nextStageLevelThreshold = nextStage?.minLevel ?? null;
  const currentStageMaxLevel =
    currentStage.maxLevel ?? nextStageLevelThreshold ?? normalizedLevel;
  const stageSpan = Math.max(
    1,
    currentStageMaxLevel - currentStage.minLevel + 1
  );
  const evolutionProgress =
    nextStageLevelThreshold === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((normalizedLevel - currentStage.minLevel + 1) / stageSpan) * 100
          )
        );

  return {
    stage: currentStage.stage,
    stageName: currentStage.label,
    evolutionProgress,
    nextStageLevelThreshold,
  };
}
