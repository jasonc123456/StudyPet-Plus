import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getGroupMembership, getGroupTask, isGroupAdmin } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { groupId: string; taskId: string; userId: string };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  try {
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

    await prisma.groupTaskAssignee.deleteMany({
      where: { taskId: params.taskId, userId: params.userId },
    });

    return jsonOk({ success: true });
  } catch (error) {
    console.error(
      'DELETE /api/groups/[groupId]/tasks/[taskId]/assignees/[userId]',
      error
    );
    return jsonError('Failed to remove task assignee', 500);
  }
}
