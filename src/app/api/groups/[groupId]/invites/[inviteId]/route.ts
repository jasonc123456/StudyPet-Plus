import { GroupInviteStatus } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getGroupInvite, getGroupMembership, isGroupAdmin } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { groupId: string; inviteId: string };
};

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
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can revoke invites', 403);
  }

  const invite = await getGroupInvite(params.groupId, params.inviteId);
  if (!invite) {
    return jsonError('Invite not found', 404);
  }

  const updatedInvite = await prisma.groupInvite.update({
    where: { id: params.inviteId },
    data: { status: GroupInviteStatus.REVOKED },
  });

  return jsonOk(updatedInvite);
}
