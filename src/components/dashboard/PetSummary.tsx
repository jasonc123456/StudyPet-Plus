import { getPetStageDisplay } from '@/lib/pet-display';

import type { DashboardPet } from '@/lib/dashboard';

type PetSummaryProps = {
  pet: DashboardPet | null;
};

export function PetSummary({ pet }: PetSummaryProps) {
  const stage = pet ? getPetStageDisplay(pet.stage) : null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">StudyPet</h2>

      {!pet || !stage ? (
        <div className="card flex flex-col items-center px-6 py-8 text-center">
          <span className="text-3xl" aria-hidden>
            🥚
          </span>
          <p className="mt-3 text-sm text-slate-500">
            No StudyPet yet. Complete quests to hatch your companion.
          </p>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <span className="text-4xl" aria-hidden>
              {stage.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">
                {pet.name}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Lv {pet.level} · {stage.label}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                XP
              </dt>
              <dd className="mt-0.5 font-semibold text-brand-600">{pet.xp}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Streak
              </dt>
              <dd className="mt-0.5 font-semibold text-mint-600">
                {pet.streakCount} day{pet.streakCount === 1 ? '' : 's'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
