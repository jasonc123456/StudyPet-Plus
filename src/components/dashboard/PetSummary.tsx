import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader';
import { StudyPetCard } from '@/components/dashboard/StudyPetCard';
import { StudyPet } from '@/components/dashboard/pet/StudyPet';
import type { DashboardPet } from '@/lib/dashboard';

type PetSummaryProps = {
  /** Live Pet row from Prisma via getDashboardData — never demo useState. */
  pet: DashboardPet | null;
};

/**
 * US-4.10 — authenticated dashboard StudyPet widget.
 * Values come from the database Pet model (name, XP, level, stage, streak).
 * StudyPetHero on the marketing landing page remains a separate demo widget.
 */
export function PetSummary({ pet }: PetSummaryProps) {
  return (
    <section>
      <DashboardSectionHeader title="StudyPet" />

      {!pet ? (
        <DashboardPanel className="flex flex-col items-center text-center">
          <div className="h-44 w-44">
            <StudyPet stage="egg" mood="happy" xpProgress={10} />
          </div>
          <p className="mt-4 text-sm font-normal text-slate-500">
            No StudyPet yet. Review flashcards, finish a quiz, or complete a
            quest to hatch your companion.
          </p>
        </DashboardPanel>
      ) : (
        <DashboardPanel>
          <StudyPetCard pet={pet} />
        </DashboardPanel>
      )}
    </section>
  );
}
