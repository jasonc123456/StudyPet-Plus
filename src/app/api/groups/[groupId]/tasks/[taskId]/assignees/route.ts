import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  ensureGroupMembers,
  getGroupMembership,
  getGroupTask,
  isGroupAdmin,
} from '@/lib/groups';
import { updateGroupTaskAssigneesSchema } from '@/lib/group-validators';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string; taskId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const task = await getGroupTask(params.groupId, params.taskId);
  if (!task) return jsonError('Task not found', 404);
  if (
    !isGroupAdmin(membership.role) &&
    task.createdById !== authResult.user.id
  ) {
    return jsonError(
      'Only admins or the task creator can manage assignees',
      403
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGroupTaskAssigneesSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  let userIds: string[] = [];
  try {
    userIds = await ensureGroupMembers(params.groupId, parsed.data.userIds);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Invalid assignees',
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.replace) {
      await tx.groupTaskAssignee.deleteMany({
        where: { taskId: params.taskId },
      });
    }

    const existingAssignees = await tx.groupTaskAssignee.findMany({
      where: { taskId: params.taskId, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingUserIds = new Set(
      existingAssignees.map((item) => item.userId)
    );
    const newUserIds = userIds.filter((userId) => !existingUserIds.has(userId));

    if (newUserIds.length > 0) {
      await tx.groupTaskAssignee.createMany({
        data: newUserIds.map((userId) => ({
          taskId: params.taskId,
          userId,
          assignedById: authResult.user.id,
        })),
      });
    }
  });

  const updatedTask = await prisma.groupTask.findUnique({
    where: { id: params.taskId },
    include: {
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  return jsonOk(updatedTask);
}
