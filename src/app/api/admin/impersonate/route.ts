// Start impersonating a user (admin only).
//
// The mechanics live in src/lib/impersonation.ts; this route is the guard rail
// around them: admin, not yourself, not another admin, explicit acknowledgement,
// and a record on both sides.

import { NextResponse } from 'next/server';

import { guardTarget, recordAdminAction, requireAdmin } from '@/lib/admin';
import { impersonateSchema } from '@/lib/admin-validators';
import { jsonError, jsonOk } from '@/lib/api-response';
import { recordAuthEvent } from '@/lib/auth-events';
import { startImpersonation } from '@/lib/impersonation';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const actor = await requireAdmin();
  if (actor instanceof NextResponse) return actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = impersonateSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodFirstError(parsed.error), 400);

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, role: true, suspendedAt: true },
  });
  if (!target) return jsonError('User not found', 404);

  const refusal = await guardTarget(actor, target.id, {
    selfMessage: 'You are already signed in as yourself.',
  });
  if (refusal) return jsonError(refusal, 400);

  // Impersonating another admin would let one admin act with a second admin's
  // authority while the audit trail names only the target — a straightforward
  // way to launder a privileged action. Support cases never need it.
  if (target.role === 'ADMIN') {
    return jsonError('Admin accounts cannot be impersonated', 400);
  }

  if (target.suspendedAt) {
    return jsonError('Reinstate this account before signing in as it', 400);
  }

  await startImpersonation(actor.id, target.id);

  await Promise.all([
    recordAdminAction({
      actor,
      action: 'IMPERSONATION_START',
      targetUserId: target.id,
      targetEmail: target.email,
      detail: 'Started an impersonation session',
    }),
    recordAuthEvent({
      type: 'IMPERSONATION_START',
      userId: target.id,
      email: target.email,
      method: 'impersonation',
      detail: `Started by ${actor.email}`,
    }),
  ]);

  return jsonOk({ ok: true });
}
