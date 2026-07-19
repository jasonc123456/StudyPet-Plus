'use client';

import { usePetProgress } from '@/hooks/usePetProgress';
import { StudyPet } from '@/components/dashboard/pet/StudyPet';
import type { DashboardPet } from '@/lib/dashboard';

type StudyPetCardProps = {
  pet: DashboardPet;
};

function getPetMood(streakCount: number, progressPercent: number) {
  if (streakCount >= 5 || progressPercent >= 80) return 'excited' as const;
  if (streakCount >= 2 || progressPercent >= 45) return 'happy' as const;
  if (progressPercent >= 20) return 'sad' as const;
  return 'tired' as const;
}

export function StudyPetCard({ pet }: StudyPetCardProps) {
  const { level, stage, evolution, mood, xpProgress, xpGain, xpBurstKey } =
    usePetProgress({
      petId: pet.id,
      currentXp: pet.xp,
      savedLevel: pet.level,
      mood: getPetMood(pet.streakCount, 0),
    });

  return (
    <div className="space-y-7">
      <div className="relative overflow-hidden rounded-[2rem] border border-[var(--card-border)] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(246,248,253,0.92)_56%,_rgba(238,243,251,0.9)_100%)] p-3 shadow-[0_30px_60px_-35px_rgba(15,23,42,0.25)]">
        <div className="pointer-events-none absolute inset-x-10 top-5 h-28 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] blur-3xl" />
        <div className="relative h-[360px] overflow-hidden rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(245,248,252,0.72)_55%,rgba(231,237,246,0.65)_100%)] sm:h-[420px] xl:h-[460px]">
          <StudyPet
            className="h-full w-full"
            stage={stage}
            mood={mood}
            xpProgress={xpProgress.percentage}
            xpBurstKey={xpBurstKey}
          />
          {xpGain > 0 ? (
            <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 animate-[pet-xp-float_1.8s_ease-out_forwards] rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] shadow-lg">
              +{xpGain} XP
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 text-center lg:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-neutral-400">
          StudyPet evolution
        </p>
        <h3 className="mt-3 truncate text-3xl font-black tracking-tight text-slate-900">
          {pet.name}
        </h3>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Level {level} · {evolution.stageLabel}
        </p>
        <p className="mt-3 max-w-2xl text-sm font-normal leading-6 text-slate-500">
          {stage === 'egg'
            ? 'Your companion is still incubating. Keep studying to crack the shell and wake it up.'
            : `Your fox is in its ${evolution.stageLabel.toLowerCase()} era and grows more magical every time you study.`}
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-widest text-neutral-400">
              <span>XP progress</span>
              <span>{xpProgress.xpNeededForNextLevel} XP to next level</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${xpProgress.percentage}%`,
                  background:
                    'linear-gradient(90deg, color-mix(in srgb, var(--accent) 85%, white) 0%, var(--accent) 100%)',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-medium text-slate-500">
              <span>{pet.xp} total XP</span>
              <span>{Math.round(xpProgress.percentage)}%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium uppercase tracking-widest text-neutral-400">
              <span>Evolution progress</span>
              <span>
                {evolution.nextStageXpThreshold
                  ? `${evolution.xpToNextStage} XP to next form`
                  : 'Final evolution unlocked'}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${evolution.progress}%`,
                  background:
                    'linear-gradient(90deg, color-mix(in srgb, var(--accent) 28%, white) 0%, color-mix(in srgb, var(--accent) 78%, #a855f7) 100%)',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm font-medium text-slate-500">
              <span>{pet.streakCount} day streak</span>
              <span>
                {evolution.nextStageXpThreshold
                  ? `${evolution.xpToNextStage} XP to evolve`
                  : 'Beast form unlocked'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
