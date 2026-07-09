import { GroupRole } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { joinGroupSchema } from '@/lib/group-validators';
import { hashInviteToken, normalizeInviteStatus } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = joinGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const invite = await prisma.groupInvite.findUnique({
    where: { tokenHash: hashInviteToken(parsed.data.token) },
    include: {
      group: {
        select: { id: true, name: true, description: true },
      },
    },
  });

  if (!invite) {
    return jsonError('Invite link is invalid', 404);
  }

  if (normalizeInviteStatus(invite) !== 'ACTIVE') {
    return jsonError('Invite link is no longer active', 410);
  }

  const existingMembership = await prisma.groupMembership.findUnique({
    where: {
      groupId_userId: {
        groupId: invite.groupId,
        userId: authResult.user.id,
      },
    },
    select: { id: true, role: true },
  });

  if (existingMembership) {
    return jsonOk({
      joined: true,
      alreadyMember: true,
      group: invite.group,
      role: existingMembership.role,
    });
  }

  await prisma.$transaction([
    prisma.groupMembership.create({
      data: {
        groupId: invite.groupId,
        userId: authResult.user.id,
        role: GroupRole.MEMBER,
      },
    }),
    prisma.groupInvite.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } },
    }),
  ]);

  return jsonOk({
    joined: true,
    alreadyMember: false,
    group: invite.group,
    role: GroupRole.MEMBER,
  });
}
