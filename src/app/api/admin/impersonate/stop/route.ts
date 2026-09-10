// End an impersonation and hand the browser back its admin session.
//
// Deliberately NOT behind requireAdmin: the caller is currently carrying the
// *target's* session, so an admin check here would fail for exactly the person
// who needs to get out. Authorization comes from the session itself — the row
// has to be flagged impersonatedByUserId, which only /api/admin/impersonate can
// set. A user who is not being impersonated gets nothing from this endpoint.

import { jsonError, jsonOk } from '@/lib/api-response';
import { recordAdminAction } from '@/lib/admin';
import { recordAuthEvent } from '@/lib/auth-events';
import { getImpersonationState, stopImpersonation } from '@/lib/impersonation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const state = await getImpersonationState();
  if (!state) return jsonError('Not impersonating', 400);

  const [admin, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: state.adminUserId },
      select: { id: true, email: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: state.targetUserId },
      select: { id: true, email: true },
    }),
  ]);

  const stopped = await stopImpersonation();
  if (!stopped) return jsonError('Not impersonating', 400);

  if (admin) {
    await Promise.all([
      recordAdminAction({
        actor: admin,
        action: 'IMPERSONATION_END',
        targetUserId: target?.id ?? null,
        targetEmail: target?.email ?? null,
        detail: 'Ended an impersonation session',
      }),
      recordAuthEvent({
        type: 'IMPERSONATION_END',
        userId: target?.id ?? null,
        email: target?.email ?? null,
        method: 'impersonation',
        detail: `Ended by ${admin.email}`,
      }),
    ]);
  }

  return jsonOk({ ok: true });
}
