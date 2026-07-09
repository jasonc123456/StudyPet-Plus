import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  getGroupChannel,
  getGroupMembership,
  isGroupAdmin,
} from '@/lib/groups';
import { updateGroupChannelSchema } from '@/lib/group-validators';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string; channelId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can update channels', 403);
  }

  const channel = await getGroupChannel(params.groupId, params.channelId);
  if (!channel) return jsonError('Channel not found', 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGroupChannelSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const updatedChannel = await prisma.groupChannel.update({
    where: { id: params.channelId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description || null,
      }),
      ...(parsed.data.position !== undefined && {
        position: parsed.data.position,
      }),
    },
  });

  return jsonOk(updatedChannel);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can delete channels', 403);
  }

  const channel = await getGroupChannel(params.groupId, params.channelId);
  if (!channel) return jsonError('Channel not found', 404);

  await prisma.groupChannel.delete({ where: { id: params.channelId } });
  return jsonOk({ success: true });
}
