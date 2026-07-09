import { jsonOk, requireUser } from '@/lib/api-response';
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
      where: { userId: authResult.user.id },
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
