import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getGroupMembership } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { groupId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) {
    return jsonError('Group not found', 404);
  }

  const members = await prisma.groupMembership.findMany({
    where: { groupId: params.groupId },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    select: {
      id: true,
      role: true,
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
  });

  return jsonOk(members);
}
