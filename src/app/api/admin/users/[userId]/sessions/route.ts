// Revoke every live session for one account.
//
// Distinct from suspension: this signs the user out everywhere without taking
// their access away, which is the right response to "their laptop was stolen"
// or "they left a session on a shared machine".

import { NextResponse } from 'next/server';

import { recordAdminAction, requireAdmin } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/api-response';
import { recordAuthEvent } from '@/lib/auth-events';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  const actor = await requireAdmin();
  if (actor instanceof NextResponse) return actor;

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true },
  });
  if (!target) return jsonError('User not found', 404);

  const { count } = await prisma.session.deleteMany({
    where: { userId: target.id },
  });

  await Promise.all([
    recordAdminAction({
      actor,
      action: 'SESSIONS_REVOKED',
      targetUserId: target.id,
      targetEmail: target.email,
      detail: `${count} session${count === 1 ? '' : 's'} revoked`,
    }),
    // Shows up in the user's own activity list, so a forced sign-out is not a
    // mystery to whoever is looking at their history later.
    recordAuthEvent({
      type: 'SIGN_OUT',
      userId: target.id,
      email: target.email,
      method: 'admin',
      detail: `Sessions revoked by ${actor.email}`,
    }),
  ]);

  return jsonOk({ ok: true, revoked: count });
}
