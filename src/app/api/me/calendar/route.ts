import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { assignedTaskWhere } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const [assignments, quests, groupTasks] = await Promise.all([
    prisma.assignment.findMany({
      where: { course: { userId: authResult.user.id } },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.quest.findMany({
      where: { userId: authResult.user.id },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    }),
    prisma.groupTaskAssignee.findMany({
      where: assignedTaskWhere(authResult.user.id),
      orderBy: [{ task: { dueAt: { sort: 'asc', nulls: 'last' } } }],
      include: {
        task: {
          include: {
            group: { select: { id: true, name: true } },
            channel: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return jsonOk({
    assignments,
    quests,
    groupTasks: groupTasks.map((assignment) => assignment.task),
  });
}

/**
 * Update the current user's calendar preferences. Today that is just the
 * "show all group tasks vs. only mine" toggle on /dashboard/calendar; the body
 * is validated narrowly so this can't be used to flip unrelated User fields.
 */
export async function PATCH(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const showAll = (body as { showAllGroupTasks?: unknown })?.showAllGroupTasks;
  if (typeof showAll !== 'boolean') {
    return jsonError('showAllGroupTasks must be a boolean', 400);
  }

  await prisma.user.update({
    where: { id: authResult.user.id },
    data: { showAllGroupTasksOnCalendar: showAll },
  });

  return jsonOk({ showAllGroupTasks: showAll });
}
