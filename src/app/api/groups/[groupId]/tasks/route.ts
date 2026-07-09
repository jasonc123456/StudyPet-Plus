import { GroupTaskStatus } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createGroupTaskSchema } from '@/lib/group-validators';
import { ensureGroupMembers, getGroupMembership } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') || undefined;
  const channelId = searchParams.get('channelId') || undefined;
  const assigneeId = searchParams.get('assigneeId') || undefined;
  const dueFrom = searchParams.get('dueFrom');
  const dueTo = searchParams.get('dueTo');
  const status = rawStatus
    ? Object.values(GroupTaskStatus).includes(rawStatus as GroupTaskStatus)
      ? (rawStatus as GroupTaskStatus)
      : null
    : undefined;

  if (rawStatus && status === null) {
    return jsonError('Invalid group task status filter', 400);
  }

  const tasks = await prisma.groupTask.findMany({
    where: {
      groupId: params.groupId,
      ...(status && { status }),
      ...(channelId && { channelId }),
      ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
      ...((dueFrom || dueTo) && {
        dueAt: {
          ...(dueFrom && { gte: new Date(dueFrom) }),
          ...(dueTo && { lte: new Date(dueTo) }),
        },
      }),
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: {
      channel: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  return jsonOk(tasks);
}

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGroupTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  if (parsed.data.channelId) {
    const channel = await prisma.groupChannel.findFirst({
      where: { id: parsed.data.channelId, groupId: params.groupId },
      select: { id: true },
    });
    if (!channel) {
      return jsonError('Channel not found in this group', 400);
    }
  }

  let assigneeUserIds: string[] = [];
  try {
    assigneeUserIds = await ensureGroupMembers(
      params.groupId,
      parsed.data.assigneeUserIds
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Invalid assignees',
      400
    );
  }

  const task = await prisma.groupTask.create({
    data: {
      groupId: params.groupId,
      createdById: authResult.user.id,
      channelId: parsed.data.channelId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueAt: parsed.data.dueAt,
      status: parsed.data.status,
      assignees: {
        create: assigneeUserIds.map((userId) => ({
          userId,
          assignedById: authResult.user.id,
        })),
      },
    },
    include: {
      channel: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  return jsonOk(task, 201);
}
