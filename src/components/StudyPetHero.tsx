'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useLivePet } from '@/hooks/useLivePet';
import { usePetProgress } from '@/hooks/usePetProgress';
import { getPetStageDisplay } from '@/lib/pet-display';
import { getLevelFromXp, getProgress } from '@/lib/pet-progress';
import { evolvePet } from '@/systems/evolution';

const STAGE_EMOJI: Record<string, string> = {
  egg: '🥚',
  hatchling: '🐣',
  baby: '🐤',
  toddler: '🐥',
  teen: '🦉',
  adult: '🦊',
  beast: '🐉',
};

const STUDY_LINKS = [
  { label: '🃏 Review cards', href: '/dashboard/flashcards' },
  { label: '❓ Take a quiz', href: '/dashboard/quizzes' },
  { label: '📖 Open dashboard', href: '/dashboard' },
] as const;

function HeroSkeleton() {
  return (
    <div
      className="card mx-auto w-full max-w-sm animate-pulse p-6 text-center"
      aria-busy="true"
      aria-label="Loading your StudyPet"
    >
      <div className="mx-auto h-24 w-24 rounded-full bg-slate-200" />
      <div className="mx-auto mt-4 h-4 w-40 rounded bg-slate-200" />
      <div className="mt-6 h-3 w-full rounded-full bg-slate-100" />
      <div className="mt-3 h-3 w-full rounded-full bg-slate-100" />
      <div className="mt-6 flex justify-center gap-2">
        <div className="h-9 w-24 rounded-lg bg-slate-100" />
        <div className="h-9 w-24 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

function GuestPreview() {
  return (
    <div className="card mx-auto w-full max-w-sm p-6 text-center">
      <span className="block text-7xl" aria-hidden>
        🥚
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700">
        Hatch your own StudyPet
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Sign in to sync XP, evolution stage, and your daily study streak from
        the live database.
      </p>
      <Link href="/login" className="btn-primary mt-5 inline-flex">
        Sign in to meet your pet
      </Link>
    </div>
  );
}

type LivePetWidgetProps = {
  petId: string;
  name: string;
  xp: number;
  level: number;
  stage: string;
  streakCount: number;
  onRefresh: () => void;
};

function LivePetWidget({
  petId,
  name,
  xp,
  level,
  stage,
  streakCount,
  onRefresh,
}: LivePetWidgetProps) {
  const [pop, setPop] = useState(false);
  const [evolvedLabel, setEvolvedLabel] = useState<string | null>(null);
  const previousStageRef = useRef(stage);

  const computedLevel = useMemo(() => getLevelFromXp(xp), [xp]);
  const displayLevel = Math.max(level, computedLevel);
  const xpProgress = useMemo(
    () => getProgress(xp, displayLevel),
    [xp, displayLevel]
  );
  const evolution = useMemo(() => evolvePet(xp), [xp]);
  const stageDisplay = useMemo(
    () => getPetStageDisplay(stage, xp),
    [stage, xp]
  );
  const stageEmoji = STAGE_EMOJI[evolution.stage] ?? '🐾';

  const { xpGain } = usePetProgress({
    petId,
    currentXp: xp,
    savedLevel: displayLevel,
  });

  useEffect(() => {
    if (previousStageRef.current === evolution.stage) return;

    setEvolvedLabel(stageDisplay.label);
    const timeout = window.setTimeout(() => setEvolvedLabel(null), 1400);
    previousStageRef.current = evolution.stage;

    return () => window.clearTimeout(timeout);
  }, [evolution.stage, stageDisplay.label]);

  function handlePoke() {
    setPop(true);
    window.setTimeout(() => setPop(false), 250);
    onRefresh();
  }

  return (
    <div className="card relative mx-auto w-full max-w-sm p-6 text-center transition-opacity duration-300">
      {evolvedLabel ? (
        <div className="absolute inset-x-0 -top-3 z-10 mx-auto w-max animate-pop-in rounded-full bg-mint-500 px-3 py-1 text-xs font-bold text-white shadow">
          ✨ Evolved to {evolvedLabel}!
        </div>
      ) : null}

      <button
        type="button"
        onClick={handlePoke}
        aria-label={`Poke ${name}`}
        className="relative mx-auto block select-none"
      >
        <span
          className={`block text-7xl transition-transform duration-300 ${
            pop ? 'animate-pet-pop' : ''
          }`}
        >
          {stageEmoji}
        </span>
        {xpGain > 0 ? (
          <span className="animate-float-up pointer-events-none absolute left-1/2 top-0 text-sm font-bold text-mint-600">
            +{xpGain} XP
          </span>
        ) : null}
      </button>

      <div className="mt-2 text-sm font-semibold text-slate-700">{name}</div>
      <div className="mt-1 text-sm font-medium text-slate-500">
        Lv {displayLevel} · {stageDisplay.label}
      </div>

      <div className="mt-4 space-y-4 text-left">
        <div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{xp} XP</span>
            <span>{xpProgress.xpNeededForNextLevel} XP to next level</span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out"
              style={{ width: `${xpProgress.percentage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Evolution</span>
            <span>
              {evolution.nextStageXpThreshold
                ? `${evolution.xpToNextStage} XP to next form`
                : 'Final form unlocked'}
            </span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-mint-500 transition-[width] duration-700 ease-out"
              style={{ width: `${evolution.progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {STUDY_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="btn-secondary px-3 py-1.5 text-sm transition hover:scale-[1.02] active:scale-95"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 text-sm text-slate-500">
        <span aria-live="polite">🔥 {streakCount} day study streak</span>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Live stats from your account — study in the app to level up.
      </p>
    </div>
  );
}

/**
 * US-4.10 — marketing hero widget wired to GET `/api/pet/xp` for signed-in users.
 */
export default function StudyPetHero() {
  const { pet, status, error, refresh } = useLivePet();

  if (status === 'loading') {
    return <HeroSkeleton />;
  }

  if (status === 'unauthorized') {
    return <GuestPreview />;
  }

  if (status === 'error') {
    return (
      <div
        className="card mx-auto w-full max-w-sm p-6 text-center"
        role="alert"
      >
        <p className="text-sm font-semibold text-amber-900">
          Could not reach your StudyPet
        </p>
        <p className="mt-2 text-sm text-amber-800">{error}</p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => void refresh()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="card mx-auto w-full max-w-sm p-6 text-center">
        <span className="block text-7xl" aria-hidden>
          🥚
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Your StudyPet is ready to hatch
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Review flashcards, finish a quiz, or complete a quest to create your
          companion.
        </p>
        <Link href="/dashboard" className="btn-primary mt-5 inline-flex">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <LivePetWidget
      petId={pet.id}
      name={pet.name}
      xp={pet.xp}
      level={pet.level}
      stage={pet.stage}
      streakCount={pet.streakCount}
      onRefresh={refresh}
    />
  );
}
