// Authorization and audit for the admin console.
//
// The console can read every account, revoke sessions, reset another user's
// second factor, delete an account outright, and sign in as one. That is the
// most dangerous surface in the app, so the guard lives here — one function
// every /api/admin route and every /dashboard/admin page calls — rather than
// being re-derived per route where one forgetful handler is a full breach.
//
// Two invariants hold everywhere below:
//
//   * An admin cannot aim the destructive operations at themselves. Deleting or
//     demoting yourself while holding the only admin role locks the console for
//     everyone, and "suspend yourself" is never intentional.
//
//   * The last admin cannot be removed. Demotion and deletion both count the
//     remaining admins first, so the roster can't reach zero.
//
// Every mutation records an AdminAuditLog row. Because the console can delete
// its own target, both sides of that row are ON DELETE SET NULL with the email
// denormalised — the trail outlives the account it describes.

import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { jsonError } from '@/lib/api-response';
import { requestContext } from '@/lib/auth-events';
import { prisma } from '@/lib/prisma';
import { requiresMfaChallenge } from '@/lib/mfa';
import type { AdminActionType } from '@prisma/client';

export type AdminActor = {
  id: string;
  email: string;
  name: string | null;
};

/** The signed-in user, when they hold the ADMIN role and are not suspended. */
export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // An admin session that hasn't cleared its second factor is still only a
  // first factor. The console is exactly where that distinction matters, so it
  // is enforced here too and not left to the dashboard layout.
  if (await requiresMfaChallenge(session.user.id)) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      suspendedAt: true,
    },
  });

  if (!user || user.role !== 'ADMIN' || user.suspendedAt) return null;

  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Admin guard for route handlers — the actor, or the response to return.
 *
 * Answers 404 rather than 403 to a non-admin. A signed-in user probing
 * /api/admin/* learns only that there is nothing there, which is the same thing
 * an anonymous request learns.
 */
export async function requireAdmin(): Promise<AdminActor | NextResponse> {
  const actor = await getAdminActor();
  if (!actor) return jsonError('Not found', 404);
  return actor;
}

/** Whether `userId` is the only remaining admin. */
export async function isLastAdmin(userId: string): Promise<boolean> {
  const admins = await prisma.user.count({
    where: { role: 'ADMIN', suspendedAt: null },
  });
  if (admins > 1) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

/**
 * Refuse an action aimed at the actor themselves, or at the last admin.
 *
 * Returns the message to send back, or null when the action may proceed.
 * `selfMessage` is null for the operations that are legitimate on yourself
 * (revoking your own other sessions, say).
 */
export async function guardTarget(
  actor: AdminActor,
  targetUserId: string,
  options: { selfMessage?: string | null; protectLastAdmin?: boolean } = {}
): Promise<string | null> {
  const {
    selfMessage = 'You cannot perform this action on your own account.',
  } = options;

  if (selfMessage && targetUserId === actor.id) return selfMessage;

  if (options.protectLastAdmin && (await isLastAdmin(targetUserId))) {
    return 'This is the last remaining admin. Promote another account first.';
  }

  return null;
}

/**
 * Record an admin action. Best-effort: the action itself already happened, and
 * losing the audit row must not turn a completed change into a 500 that invites
 * the operator to retry it.
 */
export async function recordAdminAction(input: {
  actor: AdminActor;
  action: AdminActionType;
  targetUserId?: string | null;
  targetEmail?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actor.id,
        actorEmail: input.actor.email,
        targetUserId: input.targetUserId ?? null,
        targetEmail: input.targetEmail ?? null,
        action: input.action,
        detail: input.detail ?? null,
        ip: requestContext().ip,
      },
    });
  } catch {
    // See above — the change is already durable.
  }
}
