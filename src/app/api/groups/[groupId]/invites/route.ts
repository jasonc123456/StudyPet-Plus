import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createGroupInviteSchema } from '@/lib/group-validators';
import {
  createRawInviteToken,
  getGroupMembership,
  hashInviteToken,
  isGroupAdmin,
  normalizeInviteStatus,
} from '@/lib/groups';
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
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can view invites', 403);
  }

  const invites = await prisma.groupInvite.findMany({
    where: { groupId: params.groupId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      createdAt: true,
    },
  });

  return jsonOk(
    invites.map((invite) => ({
      ...invite,
      normalizedStatus: normalizeInviteStatus(invite),
    }))
  );
}

export async function POST(request: Request, { params }: RouteContext) {
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
    return jsonError('Only admins can create invites', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGroupInviteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const rawToken = createRawInviteToken();

  const invite = await prisma.groupInvite.create({
    data: {
      groupId: params.groupId,
      createdById: authResult.user.id,
      tokenHash: hashInviteToken(rawToken),
      expiresAt: parsed.data.expiresAt,
      maxUses: parsed.data.maxUses,
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      createdAt: true,
    },
  });

  return jsonOk(
    {
      ...invite,
      joinPath: `/groups/join?token=${rawToken}`,
      inviteToken: rawToken,
    },
    201
  );
}
