// Display metadata for Pet.stage values stored in the database.
// Pet name, level, XP, and streak come from prisma.pet — not from here.

export type PetStageDisplay = {
  emoji: string;
  label: string;
};

const PET_STAGE_DISPLAY: Record<string, PetStageDisplay> = {
  egg: { emoji: '🥚', label: 'Mystery Egg' },
  hatchling: { emoji: '🐣', label: 'Hatchling' },
  chick: { emoji: '🐤', label: 'Chick' },
  owl: { emoji: '🦉', label: 'Scholar Owl' },
  dragon: { emoji: '🐉', label: 'Study Dragon' },
};

export function getPetStageDisplay(stage: string): PetStageDisplay {
  return (
    PET_STAGE_DISPLAY[stage] ?? {
      emoji: '🐾',
      label: stage || 'Unknown',
    }
  );
}
