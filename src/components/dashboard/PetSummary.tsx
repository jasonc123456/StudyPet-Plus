import { getPetStageDisplay } from '@/lib/pet-display';

import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader';
import type { DashboardPet } from '@/lib/dashboard';

type PetSummaryProps = {
  pet: DashboardPet | null;
};

export function PetSummary({ pet }: PetSummaryProps) {
  const stage = pet ? getPetStageDisplay(pet.stage) : null;

  return (
    <section className="lg:sticky lg:top-0 lg:self-start">
      <DashboardSectionHeader title="StudyPet" />

      {!pet || !stage ? (
        <DashboardPanel className="flex flex-col items-center text-center">
          <span className="text-4xl opacity-80" aria-hidden>
            🥚
          </span>
          <p className="mt-4 text-sm font-normal text-slate-500">
            No StudyPet yet. Complete quests to hatch your companion.
          </p>
        </DashboardPanel>
      ) : (
        <DashboardPanel>
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50/90 to-violet-50/80 text-3xl ring-1 ring-inset ring-indigo-100/60"
              aria-hidden
            >
              {stage.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
                {pet.name}
              </p>
              <p className="mt-0.5 text-xs font-normal text-slate-500">
                Lv {pet.level} · {stage.label}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100/80 pt-5">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">
                XP
              </dt>
              <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-brand-600">
                {pet.xp}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">
                Streak
              </dt>
              <dd className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-mint-600">
                {pet.streakCount}
                <span className="ml-1 text-sm font-medium text-slate-500">
                  day{pet.streakCount === 1 ? '' : 's'}
                </span>
              </dd>
            </div>
          </dl>
        </DashboardPanel>
      )}
    </section>
  );
}
