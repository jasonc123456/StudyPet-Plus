import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { QuestForm } from '@/components/quests/QuestForm';
import { prisma } from '@/lib/prisma';

type EditQuestPageProps = {
  params: { questId: string };
};

export default async function EditQuestPage({ params }: EditQuestPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const quest = await prisma.quest.findFirst({
    where: {
      id: params.questId,
      userId: session.user.id,
    },
  });

  if (!quest) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/quests" className="hover:text-brand-600">
          Quests
        </Link>
        <span>/</span>
        <span className="text-slate-700">Edit</span>
      </div>

      <PageHeader title="Edit quest" description={`Update "${quest.title}".`} />

      <QuestForm
        mode="edit"
        questId={quest.id}
        initialValues={{
          title: quest.title,
          description: quest.description,
          dueAt: quest.dueAt,
          status: quest.status,
          difficulty: quest.difficulty,
          xpReward: quest.xpReward,
          estimatedMinutes: quest.estimatedMinutes,
        }}
        cancelHref="/dashboard/quests"
        successHref="/dashboard/quests"
      />
    </div>
  );
}
