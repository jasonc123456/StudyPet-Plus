import { describe, expect, it } from 'vitest';

import { derivePetLevelAndStage, xpForQuizScore } from '@/lib/pet-xp.constants';

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
  it('maps XP totals to stages at the documented thresholds', () => {
    expect(derivePetLevelAndStage(0)).toEqual({ level: 1, stage: 'egg' });
    expect(derivePetLevelAndStage(89)).toEqual({ level: 1, stage: 'egg' });
    expect(derivePetLevelAndStage(90)).toEqual({
      level: 2,
      stage: 'hatchling',
    });
    expect(derivePetLevelAndStage(200)).toEqual({ level: 3, stage: 'chick' });
    expect(derivePetLevelAndStage(500)).toEqual({ level: 4, stage: 'owl' });
    expect(derivePetLevelAndStage(1000)).toEqual({
      level: 5,
      stage: 'dragon',
    });
  });
});
