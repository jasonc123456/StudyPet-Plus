import Link from 'next/link';

import { DueDate } from '@/components/DueDate';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { DashboardSectionHeader } from '@/components/dashboard/DashboardSectionHeader';
import type { DashboardQuest } from '@/lib/dashboard';

type StudyQuestsProps = {
  quests: DashboardQuest[];
};

export function StudyQuests({ quests }: StudyQuestsProps) {
  return (
    <section>
      <DashboardSectionHeader
        title="Study quests"
        href={quests.length > 0 ? '/dashboard/quests' : undefined}
      />

      {quests.length === 0 ? (
        <DashboardPanel className="flex flex-col items-center text-center">
          <span className="text-3xl opacity-80" aria-hidden>
            🎯
          </span>
          <p className="mt-4 text-sm font-normal text-slate-500">
            No open quests. Add a study goal to earn XP.
          </p>
          <Link
            href="/dashboard/quests/new"
            className="btn-primary mt-5 inline-flex text-sm"
          >
            Add quest
          </Link>
        </DashboardPanel>
      ) : (
        <div className="flex flex-col gap-2.5">
          {quests.map((quest) => (
            <Link
              key={quest.id}
              href={`/dashboard/quests/${quest.id}/edit`}
              className="dashboard-row group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50/80 text-lg ring-1 ring-inset ring-indigo-100/70"
                  aria-hidden
                >
                  🎯
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium tracking-tight text-slate-900">
                    {quest.title}
                  </p>
                  <p className="mt-1 truncate text-xs font-normal text-slate-500">
                    Due <DueDate dueAt={quest.dueAt} />
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                <span className="inline-flex shrink-0 rounded-full bg-indigo-50/90 px-3 py-1 text-[11px] font-medium tracking-wide text-indigo-600 ring-1 ring-inset ring-indigo-100/80">
                  +{quest.xpReward} XP
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
