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
  if (targetMembership.role === GroupRole.OWNER && parsed.data.role) {
    return jsonError('The owner role cannot be changed', 400);
  }

  if (parsed.data.customRoleId) {
    const customRole = await prisma.groupCustomRole.findFirst({
      where: { id: parsed.data.customRoleId, groupId: params.groupId },
      select: { id: true },
    });
    if (!customRole) {
      return jsonError('Custom role not found in this group', 400);
    }
  }

  const membership = await prisma.groupMembership.update({
    where: { id: params.memberId },
    data: {
      ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      ...(parsed.data.customRoleId !== undefined && {
        customRoleId: parsed.data.customRoleId || null,
      }),
    },
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

  // Removing the membership row is not on its own a revocation: task assignments
  // point at the User directly, and the calendar reads them by user id. Left
  // behind, they keep feeding the removed member every assigned task's title,
  // description, status, due date and group name. Both go in one transaction so
  // a failure can't leave the grant without the membership.
  await prisma.$transaction([
    prisma.groupTaskAssignee.deleteMany({
      where: {
        userId: targetMembership.userId,
        task: { groupId: params.groupId },
      },
    }),
    prisma.groupMembership.delete({ where: { id: params.memberId } }),
  ]);

  return jsonOk({ success: true });
}
