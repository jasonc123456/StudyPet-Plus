import { GroupRole } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { updateGroupSchema } from '@/lib/group-validators';
import { getGroupMembership, isGroupAdmin } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

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

  const group = await prisma.studyGroup.findUnique({
    where: { id: params.groupId },
    include: {
      channels: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          position: true,
          createdAt: true,
        },
      },
      memberships: {
        orderBy: { joinedAt: 'asc' },
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
      },
      customRoles: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          color: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          memberships: true,
          channels: true,
          tasks: true,
        },
      },
    },
  });

  return jsonOk({
    ...group,
    currentUserRole: membership.role,
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) {
    return jsonError('Group not found', 404);
  }
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can update the group', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const group = await prisma.studyGroup.update({
    where: { id: params.groupId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description || null,
      }),
    },
  });

  return jsonOk(group);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) {
    return jsonError('Group not found', 404);
  }
  if (membership.role !== GroupRole.OWNER) {
    return jsonError('Only the group owner can delete the group', 403);
  }

  await prisma.studyGroup.delete({ where: { id: params.groupId } });
  return jsonOk({ success: true });
}
