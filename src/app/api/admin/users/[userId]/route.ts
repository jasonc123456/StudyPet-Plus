// Update or delete one account (admin only).
//
// PATCH carries whichever of role / suspension / AI limit changed; DELETE is
// the irreversible one and demands the target's email back as confirmation.

import { NextResponse } from 'next/server';

import { guardTarget, recordAdminAction, requireAdmin } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import {
  deleteAdminUserSchema,
  updateAdminUserSchema,
} from '@/lib/admin-validators';
import { zodFirstError } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const actor = await requireAdmin();
  if (actor instanceof NextResponse) return actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateAdminUserSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodFirstError(parsed.error), 400);

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      email: true,
      role: true,
      suspendedAt: true,
      aiDailyLimitOverride: true,
    },
  });
  if (!target) return jsonError('User not found', 404);

  const { role, suspended, suspendedReason, aiDailyLimitOverride } =
    parsed.data;
  const data: Prisma.UserUpdateInput = {};
  const audits: {
    action: Parameters<typeof recordAdminAction>[0]['action'];
    detail: string;
  }[] = [];

  if (role !== undefined && role !== target.role) {
    // Demotion is the one that can lock everyone out, so it is guarded both
    // against self-demotion and against emptying the admin roster.
    if (role === 'USER') {
      const refusal = await guardTarget(actor, target.id, {
        selfMessage: 'You cannot remove your own admin role.',
        protectLastAdmin: true,
      });
      if (refusal) return jsonError(refusal, 400);
    }

    data.role = role;
    audits.push({
      action: role === 'ADMIN' ? 'ROLE_GRANTED' : 'ROLE_REVOKED',
      detail: `role ${target.role} -> ${role}`,
    });
  }

  if (suspended !== undefined && suspended !== Boolean(target.suspendedAt)) {
    const refusal = await guardTarget(actor, target.id, {
      selfMessage: 'You cannot suspend your own account.',
      protectLastAdmin: suspended,
    });
    if (refusal) return jsonError(refusal, 400);

    data.suspendedAt = suspended ? new Date() : null;
    data.suspendedReason = suspended ? (suspendedReason ?? null) : null;
    audits.push({
      action: suspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
      detail: suspended
        ? `suspended${suspendedReason ? `: ${suspendedReason}` : ''}`
        : 'reinstated',
    });
  }

  if (
    aiDailyLimitOverride !== undefined &&
    aiDailyLimitOverride !== target.aiDailyLimitOverride
  ) {
    data.aiDailyLimitOverride = aiDailyLimitOverride;
    audits.push({
      action: 'AI_LIMIT_OVERRIDDEN',
      detail: `daily AI limit ${target.aiDailyLimitOverride ?? 'default'} -> ${
        aiDailyLimitOverride ?? 'default'
      }`,
    });
  }

  if (!audits.length) return jsonOk({ ok: true, changed: false });

  await prisma.user.update({ where: { id: target.id }, data });

  // Suspension has to bite immediately, and the user may already be holding a
  // live session — requireUser blocks their API calls, but dropping the rows
  // ends the browser session too rather than leaving a half-usable dashboard.
  if (data.suspendedAt) {
    await prisma.session.deleteMany({ where: { userId: target.id } });
  }

  for (const audit of audits) {
    await recordAdminAction({
      actor,
      action: audit.action,
      targetUserId: target.id,
      targetEmail: target.email,
      detail: audit.detail,
    });
  }

  return jsonOk({ ok: true, changed: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const actor = await requireAdmin();
  if (actor instanceof NextResponse) return actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = deleteAdminUserSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodFirstError(parsed.error), 400);

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true },
  });
  if (!target) return jsonError('User not found', 404);

  const refusal = await guardTarget(actor, target.id, {
    selfMessage: 'You cannot delete your own account from the admin console.',
    protectLastAdmin: true,
  });
  if (refusal) return jsonError(refusal, 400);

  if (parsed.data.confirmEmail.toLowerCase() !== target.email.toLowerCase()) {
    return jsonError('The confirmation email does not match this account', 400);
  }

  // Written *before* the delete. Afterwards the row's targetUserId is nulled by
  // the FK, but actorEmail/targetEmail are denormalised so the trail still
  // names both parties.
  await recordAdminAction({
    actor,
    action: 'USER_DELETED',
    targetUserId: target.id,
    targetEmail: target.email,
    detail: 'Account and all owned content deleted',
  });

  await prisma.user.delete({ where: { id: target.id } });

  return jsonOk({ ok: true });
}
