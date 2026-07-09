import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  getGroupMembership,
  getGroupMessage,
  isGroupAdmin,
} from '@/lib/groups';
import { updateGroupMessageSchema } from '@/lib/group-validators';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string; messageId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const message = await getGroupMessage(params.groupId, params.messageId);
  if (!message) return jsonError('Message not found', 404);
  if (
    message.authorId !== authResult.user.id &&
    !isGroupAdmin(membership.role)
  ) {
    return jsonError('You cannot edit this message', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGroupMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const updatedMessage = await prisma.groupMessage.update({
    where: { id: params.messageId },
    data: {
      ...(parsed.data.content !== undefined && {
        content: parsed.data.content,
      }),
      editedAt: new Date(),
    },
  });

  return jsonOk(updatedMessage);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const message = await getGroupMessage(params.groupId, params.messageId);
  if (!message) return jsonError('Message not found', 404);
  if (
    message.authorId !== authResult.user.id &&
    !isGroupAdmin(membership.role)
  ) {
    return jsonError('You cannot delete this message', 403);
  }

  await prisma.groupMessage.delete({ where: { id: params.messageId } });
  return jsonOk({ success: true });
}
