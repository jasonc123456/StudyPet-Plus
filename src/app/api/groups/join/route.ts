import { GroupInviteStatus, GroupRole } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { joinGroupSchema } from '@/lib/group-validators';
import { hashInviteToken, normalizeInviteStatus } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

/** Thrown to roll the join transaction back when the slot claim loses a race. */
class InviteExhaustedError extends Error {}

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

  // Claim a slot and create the membership in one transaction, and make the
  // claim itself conditional. The capacity check above reads a value that is
  // already stale by the time we get here, so with a plain increment two users
  // racing the last slot both saw room and both committed — the limit was
  // advisory under any concurrency at all.
  //
  // updateMany with the capacity in the WHERE clause makes the database the
  // arbiter: exactly one of the racing transactions matches a row, and the
  // loser sees count 0 and creates nothing.
  // An unlimited invite has no capacity clause at all. Standing in a sentinel
  // like Number.MAX_SAFE_INTEGER instead would overflow useCount's int4 column
  // and fail every unlimited join.
  const capacityWhere =
    invite.maxUses === null ? {} : { useCount: { lt: invite.maxUses } };

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.groupInvite.updateMany({
        where: {
          id: invite.id,
          status: GroupInviteStatus.ACTIVE,
          ...capacityWhere,
          // Expiry is re-checked here too, so the claim is authoritative on
          // every reason an invite can be unusable, not just capacity.
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: { useCount: { increment: 1 } },
      });

      if (count === 0) {
        throw new InviteExhaustedError();
      }

      await tx.groupMembership.create({
        data: {
          groupId: invite.groupId,
          userId: authResult.user.id,
          role: GroupRole.MEMBER,
        },
      });
    });
  } catch (error) {
    if (error instanceof InviteExhaustedError) {
      return jsonError('Invite link is no longer active', 410);
    }
    throw error;
  }

  return jsonOk({
    joined: true,
    alreadyMember: false,
    group: invite.group,
    role: GroupRole.MEMBER,
  });
}
