import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createGroupMessageSchema } from '@/lib/group-validators';
import { getGroupChannel, getGroupMembership } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string; channelId: string };
};

export async function GET(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const channel = await getGroupChannel(params.groupId, params.channelId);
  if (!channel) return jsonError('Channel not found', 404);

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor');
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get('limit') || '50'))
  );

  const messages = await prisma.groupMessage.findMany({
    where: {
      groupId: params.groupId,
      channelId: params.channelId,
    },
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return jsonOk(messages.reverse());
}

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const channel = await getGroupChannel(params.groupId, params.channelId);
  if (!channel) return jsonError('Channel not found', 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGroupMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const message = await prisma.groupMessage.create({
    data: {
      groupId: params.groupId,
      channelId: params.channelId,
      authorId: authResult.user.id,
      content: parsed.data.content,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return jsonOk(message, 201);
}
