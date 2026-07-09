import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createGroupChannelSchema } from '@/lib/group-validators';
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
  if (!membership) return jsonError('Group not found', 404);

  const channels = await prisma.groupChannel.findMany({
    where: { groupId: params.groupId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: {
        select: { messages: true, tasks: true },
      },
    },
  });

  return jsonOk(channels);
}

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can create channels', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGroupChannelSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const channel = await prisma.groupChannel.create({
    data: {
      groupId: params.groupId,
      createdById: authResult.user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      position: parsed.data.position,
    },
  });

  return jsonOk(channel, 201);
}
