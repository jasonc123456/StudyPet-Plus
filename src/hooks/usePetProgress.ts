'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getLevelFromXp, getProgress, type PetStage } from '@/lib/pet-progress';
import { evolvePet } from '@/systems/evolution';

type UsePetProgressArgs = {
  petId: string;
  currentXp: number;
  savedLevel?: number;
  mood?: PetMood;
};

export type PetMood = 'happy' | 'sad' | 'tired' | 'excited';

export function usePetProgress({
  petId,
  currentXp,
  savedLevel,
  mood = 'happy',
}: UsePetProgressArgs) {
  const computedLevel = useMemo(() => getLevelFromXp(currentXp), [currentXp]);
  const level = Math.max(savedLevel ?? computedLevel, computedLevel);
  const xpProgress = useMemo(
    () => getProgress(currentXp, level),
    [currentXp, level]
  );
  const evolution = useMemo(() => evolvePet(currentXp), [currentXp]);
  const previousXpRef = useRef<number | null>(null);
  const [xpGain, setXpGain] = useState(0);
  const [xpBurstKey, setXpBurstKey] = useState(0);

  useEffect(() => {
    const storageKey = `studypet:last-xp:${petId}`;
    const storedXp = window.localStorage.getItem(storageKey);
    const baselineXp =
      previousXpRef.current ??
      (storedXp === null ? null : Number.parseInt(storedXp, 10));

    if (
      baselineXp !== null &&
      Number.isFinite(baselineXp) &&
      currentXp > baselineXp
    ) {
      setXpGain(currentXp - baselineXp);
      setXpBurstKey((current) => current + 1);

      const timeout = window.setTimeout(() => {
        setXpGain(0);
      }, 1800);

      window.localStorage.setItem(storageKey, String(currentXp));
      previousXpRef.current = currentXp;

      return () => window.clearTimeout(timeout);
    }

    window.localStorage.setItem(storageKey, String(currentXp));
    previousXpRef.current = currentXp;
    return undefined;
  }, [currentXp, petId]);

  return {
    level,
    stage: evolution.stage as PetStage,
    evolution,
    mood,
    xpProgress,
    xpGain,
    xpBurstKey,
  };
}
