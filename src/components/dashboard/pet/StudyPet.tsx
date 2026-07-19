'use client';

import dynamic from 'next/dynamic';

import type { PetMood } from '@/hooks/usePetProgress';
import type { PetStage } from '@/lib/pet-progress';

type StudyPetProps = {
  stage: PetStage;
  mood: PetMood;
  xpProgress: number;
  xpBurstKey?: number;
  className?: string;
};

const DynamicPetScene = dynamic(
  () =>
    import('@/components/dashboard/pet/PetScene').then(
      (module) => module.PetScene
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-[1.6rem] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(248,240,252,0.86)_40%,_rgba(230,242,252,0.9)_100%)]">
        <div className="h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.98),rgba(247,193,224,0.6)_42%,rgba(167,236,255,0.68)_100%)] shadow-[0_0_50px_rgba(236,171,226,0.25)]" />
      </div>
    ),
  }
);

export function StudyPet(props: StudyPetProps) {
  return <DynamicPetScene {...props} />;
}
