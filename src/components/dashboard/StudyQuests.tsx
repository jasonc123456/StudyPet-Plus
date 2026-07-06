import Link from 'next/link';

import { DueDate } from '@/components/DueDate';
import type { DashboardQuest } from '@/lib/dashboard';

type StudyQuestsProps = {
  quests: DashboardQuest[];
};

export function StudyQuests({ quests }: StudyQuestsProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Study quests</h2>
        {quests.length > 0 && (
          <Link
            href="/dashboard/quests"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View all
          </Link>
        )}
      </div>

      {quests.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-8 text-center">
          <span className="text-3xl" aria-hidden>
            🎯
          </span>
          <p className="mt-3 text-sm text-slate-500">
            No open quests. Add a study goal to earn XP.
          </p>
          <Link
            href="/dashboard/quests/new"
            className="btn-primary mt-4 inline-flex text-sm"
          >
            Add quest
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {quests.map((quest) => (
            <Link
              key={quest.id}
              href={`/dashboard/quests/${quest.id}/edit`}
              className="card flex items-center gap-3 p-4 transition hover:border-brand-200"
            >
              <span className="text-2xl" aria-hidden>
                🎯
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {quest.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  Due <DueDate dueAt={quest.dueAt} />
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                +{quest.xpReward} XP
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
