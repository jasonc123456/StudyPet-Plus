// Login-gate TOTP verification (US-4.S1). The signed-in-but-unverified user
// submits a 6-digit code; on success the current session clears the MFA gate.

import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUserPreMfa } from '@/lib/api-response';
import {
  clearTotpFailures,
  getSessionToken,
  markSessionMfaVerified,
  recordTotpFailure,
  totpLockoutState,
  verifyTotp,
} from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import { totpCodeSchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUserPreMfa();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = totpCodeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpSecret: true,
      totpActivatedAt: true,
      totpFailedAttempts: true,
      totpLockedUntil: true,
    },
  });
  if (!user?.totpSecret || !user.totpActivatedAt) {
    return jsonError('TOTP is not set up on this account', 400);
  }

  // Checked before the code is compared, so a locked-out attacker learns nothing
  // from the response about whether the guess was right.
  const lockout = totpLockoutState(user.totpLockedUntil);
  if (lockout.locked) {
    return jsonError(
      'Too many incorrect codes. Try again in a few minutes.',
      429,
      { 'Retry-After': String(lockout.retryAfterSeconds) }
    );
  }

  if (!(await verifyTotp(parsed.data.code, user.totpSecret))) {
    const tripped = await recordTotpFailure(userId, user.totpFailedAttempts);
    if (tripped.locked) {
      return jsonError(
        'Too many incorrect codes. Try again in a few minutes.',
        429,
        { 'Retry-After': String(tripped.retryAfterSeconds) }
      );
    }
    return jsonError('That code is not valid. Try the current one.', 400);
  }

  await clearTotpFailures(userId);

  const token = getSessionToken();
  if (token) await markSessionMfaVerified(token);

  return jsonOk({ ok: true });
}
