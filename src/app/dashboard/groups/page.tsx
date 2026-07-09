import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { GroupsPageClient } from '@/components/groups/GroupsPageClient';
import { PageHeader } from '@/components/courses/PageHeader';
import { buildGroupSummary, isMissingGroupTables } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

export default async function GroupsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  let groupsReady = true;
  let groups: Array<ReturnType<typeof buildGroupSummary>> = [];

  try {
    const results = await prisma.studyGroup.findMany({
      where: {
        memberships: {
          some: {
            userId: session.user.id,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        memberships: {
          where: { userId: session.user.id },
          select: { role: true },
        },
        _count: {
          select: {
            memberships: true,
            channels: true,
            tasks: true,
          },
        },
      },
    });

    groups = results.map(buildGroupSummary);
  } catch (error) {
    if (isMissingGroupTables(error)) {
      groupsReady = false;
    } else {
      throw error;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Groups"
        description="Create private collaboration spaces with invite-only access, Discord-style channels, shared tasks, and a group calendar."
      />

      <GroupsPageClient groups={groups} groupsReady={groupsReady} />
    </div>
  );
}
