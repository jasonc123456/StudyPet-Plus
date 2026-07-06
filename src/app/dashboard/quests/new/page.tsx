import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { PageHeader } from '@/components/courses/PageHeader';
import { QuestForm } from '@/components/quests/QuestForm';

export default async function NewQuestPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New quest"
        description="Create a study goal with an XP reward."
      />

      <QuestForm
        mode="create"
        cancelHref="/dashboard/quests"
        successHref="/dashboard/quests"
      />
    </div>
  );
}
