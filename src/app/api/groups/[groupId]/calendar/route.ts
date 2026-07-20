import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getGroupMembership } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { groupId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  try {
    const membership = await getGroupMembership(
      params.groupId,
      authResult.user.id
    );
    if (!membership) return jsonError('Group not found', 404);

    const tasks = await prisma.groupTask.findMany({
      where: { groupId: params.groupId },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        channel: { select: { id: true, name: true } },
      },
    });

    return jsonOk(
      tasks.map((task) => ({
        id: task.id,
        source: 'group_task',
        title: task.title,
        description: task.description,
        dueAt: task.dueAt,
        status: task.status,
        channel: task.channel,
        assignees: task.assignees.map((assignee) => assignee.user),
      }))
    );
  } catch (error) {
    console.error('GET /api/groups/[groupId]/calendar', error);
    return jsonError('Failed to load group calendar', 500);
  }
}
