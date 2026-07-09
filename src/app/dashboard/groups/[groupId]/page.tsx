import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { GroupWorkspace } from '@/components/groups/GroupWorkspace';
import { isMissingGroupTables } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

type GroupWorkspacePageProps = {
  params: { groupId: string };
  searchParams: {
    tab?: string;
    channel?: string;
  };
};

export default async function GroupWorkspacePage({
  params,
  searchParams,
}: GroupWorkspacePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  try {
    const group = await prisma.studyGroup.findFirst({
      where: {
        id: params.groupId,
        memberships: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        channels: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            position: true,
            createdAt: true,
          },
        },
        memberships: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            role: true,
            customRole: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        tasks: {
          orderBy: [
            { dueAt: { sort: 'asc', nulls: 'last' } },
            { createdAt: 'desc' },
          ],
          include: {
            channel: { select: { id: true, name: true } },
            createdBy: {
              select: { id: true, name: true, email: true, image: true },
            },
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
        customRoles: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            color: true,
            createdAt: true,
          },
        },
        invites: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            maxUses: true,
            useCount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!group) {
      notFound();
    }

    const currentMembership = group.memberships.find(
      (membership) => membership.user.id === session.user.id
    );
    const adminView =
      currentMembership?.role === 'OWNER' ||
      currentMembership?.role === 'ADMIN';
    const selectedChannelId =
      group.channels.find((channel) => channel.id === searchParams.channel)
        ?.id ||
      group.channels[0]?.id ||
      null;
    const initialMessages = selectedChannelId
      ? await prisma.groupMessage.findMany({
          where: {
            groupId: group.id,
            channelId: selectedChannelId,
          },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          take: 100,
        })
      : [];

    return (
      <GroupWorkspace
        currentUserId={session.user.id}
        group={{
          id: group.id,
          name: group.name,
          description: group.description,
          currentUserRole: currentMembership?.role || 'MEMBER',
        }}
        initialTab={searchParams.tab || 'chat'}
        initialSelectedChannelId={selectedChannelId}
        channels={group.channels.map((channel) => ({
          ...channel,
          createdAt: channel.createdAt.toISOString(),
        }))}
        members={group.memberships.map((membership) => ({
          ...membership,
          joinedAt: membership.joinedAt.toISOString(),
        }))}
        customRoles={group.customRoles.map((customRole) => ({
          ...customRole,
          createdAt: customRole.createdAt.toISOString(),
        }))}
        initialMessages={initialMessages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        }))}
        tasks={group.tasks.map((task) => ({
          ...task,
          dueAt: task.dueAt ? task.dueAt.toISOString() : null,
        }))}
        invites={
          adminView
            ? group.invites.map((invite) => ({
                ...invite,
                normalizedStatus:
                  invite.status === 'ACTIVE' &&
                  ((invite.expiresAt && invite.expiresAt < new Date()) ||
                    (invite.maxUses !== null &&
                      invite.useCount >= invite.maxUses))
                    ? 'EXPIRED'
                    : invite.status,
                expiresAt: invite.expiresAt
                  ? invite.expiresAt.toISOString()
                  : null,
                createdAt: invite.createdAt.toISOString(),
              }))
            : []
        }
      />
    );
  } catch (error) {
    if (!isMissingGroupTables(error)) {
      throw error;
    }

    return (
      <DashboardPanel>
        <h1 className="text-2xl font-semibold text-slate-900">
          Groups need a database migration first
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Run{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">
            npx prisma migrate dev
          </code>{' '}
          locally so the collaboration tables exist, then refresh this page.
        </p>
      </DashboardPanel>
    );
  }
}
