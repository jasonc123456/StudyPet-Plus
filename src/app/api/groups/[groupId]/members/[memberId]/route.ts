import { GroupRole } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { updateGroupMemberSchema } from '@/lib/group-validators';
import { getGroupMembership, isGroupAdmin } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string; memberId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const actorMembership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!actorMembership) {
    return jsonError('Group not found', 404);
  }
  if (!isGroupAdmin(actorMembership.role)) {
    return jsonError('Only admins can update roles', 403);
  }

  const targetMembership = await prisma.groupMembership.findFirst({
    where: { id: params.memberId, groupId: params.groupId },
  });
  if (!targetMembership) {
    return jsonError('Member not found', 404);
  }
  if (targetMembership.role === GroupRole.OWNER) {
    return jsonError('The owner role cannot be changed', 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGroupMemberSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const membership = await prisma.groupMembership.update({
    where: { id: params.memberId },
    data: { role: parsed.data.role },
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

  return jsonOk(membership);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const actorMembership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!actorMembership) {
    return jsonError('Group not found', 404);
  }
  if (!isGroupAdmin(actorMembership.role)) {
    return jsonError('Only admins can remove members', 403);
  }

  const targetMembership = await prisma.groupMembership.findFirst({
    where: { id: params.memberId, groupId: params.groupId },
  });
  if (!targetMembership) {
    return jsonError('Member not found', 404);
  }
  if (targetMembership.role === GroupRole.OWNER) {
    return jsonError('The owner cannot be removed', 400);
  }

  await prisma.groupMembership.delete({ where: { id: params.memberId } });
  return jsonOk({ success: true });
}
