import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { QuestEmptyState } from '@/components/quests/QuestEmptyState';
import { QuestRow } from '@/components/quests/QuestRow';
import { prisma } from '@/lib/prisma';

type QuestsPageProps = {
  searchParams: {
    status?: string;
  };
};

export default async function QuestsPage({ searchParams }: QuestsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const quests = await prisma.quest.findMany({
    where: {
      userId: session.user.id,
      ...(searchParams.status && { status: searchParams.status }),
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  const hasFilters = Boolean(searchParams.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quests"
        description="Track study goals and reward them with XP."
        action={{ label: 'Add quest', href: '/dashboard/quests/new' }}
      />

      {quests.length === 0 ? (
        <QuestEmptyState
          message={
            hasFilters
              ? 'No quests match your filters.'
              : 'No quests yet. Add one to start rewarding study goals with XP.'
          }
          actionHref="/dashboard/quests/new"
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Goal</th>
                <th className="px-4 py-3">Reward</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quests.map((quest) => (
                <QuestRow key={quest.id} quest={quest} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
