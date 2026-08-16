// TOTP enrollment (US-4.S1). One route, three actions:
//   setup    — stage a pending secret, return the otpauth URI + QR to scan
//   activate — confirm a code, promoting the pending secret to the active factor
//   disable  — remove TOTP as a factor
//
// Enrollment is two-phase on purpose. `setup` writes only totpPendingSecret;
// the active totpSecret/totpActivatedAt pair is untouched until `activate`
// verifies a code against the pending one. Before that split, re-running setup
// wiped the working factor up front, so an abandoned (or hostile) enrollment
// left the account with no second factor at all.
//
// requireUser() already refuses a session that hasn't cleared the MFA gate, so
// every action here is reachable only by a session that either proved the
// existing factor or has no factor to prove (first-time enrollment).
//
// Activating also marks the current session MFA-verified: the user just proved
// possession, so we don't immediately bounce them to the /mfa gate.

import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  buildOtpAuthUrl,
  generateTotpSecret,
  getSessionToken,
  markSessionMfaVerified,
  verifyTotp,
} from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import { totpActionSchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = totpActionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  if (parsed.data.action === 'setup') {
    const secret = generateTotpSecret();
    // Staged only. The active factor keeps working until `activate` proves the
    // user really holds this new secret.
    await prisma.user.update({
      where: { id: userId },
      data: { totpPendingSecret: secret },
    });
    const otpauthUrl = buildOtpAuthUrl(secret, authResult.user.email ?? userId);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return jsonOk({ otpauthUrl, secret, qrDataUrl });
  }

  if (parsed.data.action === 'activate') {
    const code = parsed.data.code?.replace(/\s+/g, '') ?? '';
    if (!/^\d{6}$/.test(code)) {
      return jsonError('Enter the 6-digit code from your app', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpPendingSecret: true },
    });
    if (!user?.totpPendingSecret) {
      return jsonError('Start TOTP setup before confirming a code', 400);
    }
    if (!(await verifyTotp(code, user.totpPendingSecret))) {
      return jsonError('That code is not valid. Try the current one.', 400);
    }

    // Promote: the staged secret becomes the active factor in one write, so
    // there is no window where the account has neither.
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: user.totpPendingSecret,
        totpPendingSecret: null,
        totpActivatedAt: new Date(),
      },
    });

    const token = getSessionToken();
    if (token) await markSessionMfaVerified(token);

    return jsonOk({ ok: true });
  }

  // disable — also drops any half-finished enrollment.
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpPendingSecret: null,
      totpActivatedAt: null,
    },
  });
  return jsonOk({ ok: true });
}
