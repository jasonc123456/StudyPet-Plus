// Clear a user's second factor (admin only) — the account-recovery path.
//
// This is what an admin does when someone loses their authenticator and their
// passkeys with it. It is genuinely a security downgrade for the target, so it
// is audited and it also drops their live sessions: whoever is currently signed
// in on that account should have to come back through the front door now that
// the factor is gone.

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
    select: {
      id: true,
      email: true,
      totpActivatedAt: true,
      _count: { select: { authenticators: true } },
    },
  });
  if (!target) return jsonError('User not found', 404);

  const hadTotp = target.totpActivatedAt !== null;
  const passkeys = target._count.authenticators;

  if (!hadTotp && passkeys === 0) {
    return jsonError('This account has no second factor to reset', 400);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: target.id },
      data: {
        totpSecret: null,
        totpPendingSecret: null,
        totpActivatedAt: null,
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      },
    }),
    prisma.authenticator.deleteMany({ where: { userId: target.id } }),
    prisma.session.deleteMany({ where: { userId: target.id } }),
  ]);

  const detail = [
    hadTotp ? 'TOTP cleared' : null,
    passkeys ? `${passkeys} passkey${passkeys === 1 ? '' : 's'} removed` : null,
  ]
    .filter(Boolean)
    .join(', ');

  await Promise.all([
    recordAdminAction({
      actor,
      action: 'MFA_RESET',
      targetUserId: target.id,
      targetEmail: target.email,
      detail,
    }),
    // Logged as the sign-out it causes, not as an MFA failure: MFA_FAILED
    // feeds the "failed attempts" security metric, and an administrative
    // reset appearing there would read as an attack on the account.
    recordAuthEvent({
      type: 'SIGN_OUT',
      userId: target.id,
      email: target.email,
      method: 'admin',
      detail: `Second factor reset by ${actor.email} (${detail})`,
    }),
  ]);

  return jsonOk({ ok: true, detail });
}
