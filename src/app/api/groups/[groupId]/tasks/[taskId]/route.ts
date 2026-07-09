import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  ensureGroupMembers,
  getGroupMembership,
  getGroupTask,
  isGroupAdmin,
} from '@/lib/groups';
import { updateGroupTaskSchema } from '@/lib/group-validators';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string; taskId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const task = await prisma.groupTask.findFirst({
    where: { id: params.taskId, groupId: params.groupId },
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

  if (!task) return jsonError('Task not found', 404);
  return jsonOk(task);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const existing = await getGroupTask(params.groupId, params.taskId);
  if (!existing) return jsonError('Task not found', 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGroupTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const isCreator = existing.createdById === authResult.user.id;
  const isAssigned = existing.assignees.some(
    (assignee) => assignee.userId === authResult.user.id
  );
  const admin = isGroupAdmin(membership.role);
  const changingOnlyStatus =
    Object.keys(parsed.data).length === 1 && parsed.data.status !== undefined;

  if (!admin && !isCreator && !(isAssigned && changingOnlyStatus)) {
    return jsonError('You do not have permission to update this task', 403);
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

  let assigneeUserIds: string[] | undefined;
  if (parsed.data.assigneeUserIds !== undefined) {
    if (!admin && !isCreator) {
      return jsonError('Only admins or task creators can reassign tasks', 403);
    }
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
  }

  const task = await prisma.$transaction(async (tx) => {
    if (assigneeUserIds !== undefined) {
      await tx.groupTaskAssignee.deleteMany({
        where: { taskId: params.taskId },
      });
      if (assigneeUserIds.length > 0) {
        await tx.groupTaskAssignee.createMany({
          data: assigneeUserIds.map((userId) => ({
            taskId: params.taskId,
            userId,
            assignedById: authResult.user.id,
          })),
        });
      }
    }

    return tx.groupTask.update({
      where: { id: params.taskId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description || null,
        }),
        ...(parsed.data.dueAt !== undefined && { dueAt: parsed.data.dueAt }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.channelId !== undefined && {
          channelId: parsed.data.channelId || null,
        }),
      },
      include: {
        channel: { select: { id: true, name: true } },
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });
  });

  return jsonOk(task);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const existing = await getGroupTask(params.groupId, params.taskId);
  if (!existing) return jsonError('Task not found', 404);
  if (
    !isGroupAdmin(membership.role) &&
    existing.createdById !== authResult.user.id
  ) {
    return jsonError('Only admins or the task creator can delete tasks', 403);
  }

  await prisma.groupTask.delete({ where: { id: params.taskId } });
  return jsonOk({ success: true });
}
