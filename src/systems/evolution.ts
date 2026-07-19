import type { PetStage } from '@/lib/pet-progress';

export const EVOLUTION_BASE_XP = 100;
export const EVOLUTION_GROWTH_RATE = 1.8;

export const PET_EVOLUTION_STAGES = [
  { stage: 'egg', label: 'Egg', index: 0 },
  { stage: 'hatchling', label: 'Hatchling', index: 1 },
  { stage: 'baby', label: 'Baby', index: 2 },
  { stage: 'toddler', label: 'Toddler', index: 3 },
  { stage: 'teen', label: 'Teen', index: 4 },
  { stage: 'adult', label: 'Adult', index: 5 },
  { stage: 'beast', label: 'Beast', index: 6 },
] as const satisfies ReadonlyArray<{
  stage: PetStage;
  label: string;
  index: number;
}>;

export type PetEvolutionStage = (typeof PET_EVOLUTION_STAGES)[number];

export type EvolutionResult = {
  stage: PetStage;
  stageLabel: string;
  stageIndex: number;
  currentStageXpFloor: number;
  nextStageXpThreshold: number | null;
  xpToNextStage: number;
  progress: number;
};

export function getEvolutionStageXp(stageIndex: number) {
  return Math.floor(
    EVOLUTION_BASE_XP * Math.pow(EVOLUTION_GROWTH_RATE, Math.max(0, stageIndex))
  );
}

export function getEvolutionStageThreshold(stageIndex: number) {
  let totalXp = 0;

  for (let index = 0; index < stageIndex; index += 1) {
    totalXp += getEvolutionStageXp(index);
  }

  return totalXp;
}

export function evolvePet(currentXp: number): EvolutionResult {
  const normalizedXp = Math.max(0, Math.floor(currentXp));
  let resolvedStage: PetEvolutionStage = PET_EVOLUTION_STAGES[0];

  for (const stage of PET_EVOLUTION_STAGES) {
    if (normalizedXp >= getEvolutionStageThreshold(stage.index)) {
      resolvedStage = stage;
      continue;
    }

    break;
  }

  const nextStage = PET_EVOLUTION_STAGES[resolvedStage.index + 1] ?? null;
  const currentStageXpFloor = getEvolutionStageThreshold(resolvedStage.index);
  const nextStageXpThreshold = nextStage
    ? getEvolutionStageThreshold(nextStage.index)
    : null;
  const stageSpan =
    nextStageXpThreshold === null
      ? Math.max(1, getEvolutionStageXp(resolvedStage.index))
      : Math.max(1, nextStageXpThreshold - currentStageXpFloor);
  const progress =
    nextStageXpThreshold === null
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ((normalizedXp - currentStageXpFloor) / stageSpan) * 100
          )
        );

  return {
    stage: resolvedStage.stage,
    stageLabel: resolvedStage.label,
    stageIndex: resolvedStage.index,
    currentStageXpFloor,
    nextStageXpThreshold,
    xpToNextStage:
      nextStageXpThreshold === null
        ? 0
        : Math.max(0, nextStageXpThreshold - normalizedXp),
    progress,
  };
}
