// Login-gate TOTP verification (US-4.S1). The signed-in-but-unverified user
// submits a 6-digit code; on success the current session clears the MFA gate.

import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUserPreMfa } from '@/lib/api-response';
import { getSessionToken, markSessionMfaVerified, verifyTotp } from '@/lib/mfa';
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
    select: { totpSecret: true, totpActivatedAt: true },
  });
  if (!user?.totpSecret || !user.totpActivatedAt) {
    return jsonError('TOTP is not set up on this account', 400);
  }

  if (!(await verifyTotp(parsed.data.code, user.totpSecret))) {
    return jsonError('That code is not valid. Try the current one.', 400);
  }

  const token = getSessionToken();
  if (token) await markSessionMfaVerified(token);

  return jsonOk({ ok: true });
}
