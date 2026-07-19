import { describe, expect, it } from 'vitest';

import { derivePetLevelAndStage, xpForQuizScore } from '@/lib/pet-xp.constants';
import {
  getPetStage,
  getProgress,
  getXpRequired,
  getLevelFromXp,
} from '@/lib/pet-progress';

describe('xpForQuizScore', () => {
  it('pays the tier that matches the rounded score percent', () => {
    expect(xpForQuizScore(10, 10)).toBe(15); // 100%
    expect(xpForQuizScore(9, 10)).toBe(15); // 90%
    expect(xpForQuizScore(8, 10)).toBe(12); // 80%
    expect(xpForQuizScore(3, 4)).toBe(12); // 75%
    expect(xpForQuizScore(6, 10)).toBe(9); // 60%
    expect(xpForQuizScore(5, 10)).toBe(6); // 50%
    expect(xpForQuizScore(0, 10)).toBe(6); // completing still earns the floor
  });

  it('awards nothing for an empty quiz', () => {
    expect(xpForQuizScore(0, 0)).toBe(0);
  });
});

describe('derivePetLevelAndStage', () => {
  it('maps XP totals to nonlinear levels and level-based stages', () => {
    expect(derivePetLevelAndStage(0)).toEqual({ level: 1, stage: 'egg' });
    expect(derivePetLevelAndStage(99)).toEqual({ level: 1, stage: 'egg' });
    expect(derivePetLevelAndStage(100)).toEqual({
      level: 2,
      stage: 'egg',
    });
    expect(derivePetLevelAndStage(382)).toEqual({
      level: 3,
      stage: 'hatchling',
    });
    expect(derivePetLevelAndStage(901)).toEqual({
      level: 4,
      stage: 'hatchling',
    });
    expect(derivePetLevelAndStage(2889)).toEqual({
      level: 5,
      stage: 'hatchling',
    });
    expect(derivePetLevelAndStage(4000)).toEqual({
      level: 6,
      stage: 'baby',
    });
  });
});

describe('pet progress utilities', () => {
  it('scales XP exponentially by level', () => {
    expect(getXpRequired(1)).toBe(100);
    expect(getXpRequired(2)).toBe(282);
    expect(getXpRequired(3)).toBe(519);
  });

  it('returns level progress and remaining XP', () => {
    expect(getLevelFromXp(420)).toBe(3);
    expect(getProgress(420, 3)).toEqual({
      percentage: expect.closeTo(7.32, 2),
      xpNeededForNextLevel: 481,
      currentLevelFloorXp: 382,
      nextLevelXp: 901,
    });
  });

  it('maps stages from level ranges', () => {
    expect(getPetStage(1)).toMatchObject({
      stage: 'egg',
      nextStageLevelThreshold: 3,
    });
    expect(getPetStage(4)).toMatchObject({
      stage: 'hatchling',
      nextStageLevelThreshold: 6,
    });
    expect(getPetStage(22)).toMatchObject({
      stage: 'teen',
      nextStageLevelThreshold: 31,
    });
    expect(getPetStage(54)).toMatchObject({
      stage: 'beast',
      nextStageLevelThreshold: null,
      evolutionProgress: 100,
    });
  });
});
