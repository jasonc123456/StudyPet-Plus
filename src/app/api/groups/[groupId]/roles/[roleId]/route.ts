import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getGroupMembership, isGroupAdmin } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { groupId: string; roleId: string };
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
    if (!isGroupAdmin(membership.role)) {
      return jsonError('Only admins can delete custom roles', 403);
    }

    const customRole = await prisma.groupCustomRole.findFirst({
      where: { id: params.roleId, groupId: params.groupId },
      select: { id: true },
    });
    if (!customRole) {
      return jsonError('Custom role not found', 404);
    }

    await prisma.groupCustomRole.delete({ where: { id: params.roleId } });
    return jsonOk({ success: true });
  } catch (error) {
    console.error('DELETE /api/groups/[groupId]/roles/[roleId]', error);
    return jsonError('Failed to delete custom role', 500);
  }
}
