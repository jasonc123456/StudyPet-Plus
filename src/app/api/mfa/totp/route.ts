// TOTP enrollment (US-4.S1). One route, three actions:
//   setup    — mint a pending secret, return the otpauth URI + QR to scan
//   activate — confirm a code, making TOTP an active second factor
//   disable  — remove TOTP as a factor
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
    // Store as pending: totpSecret set, totpActivatedAt still null.
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpActivatedAt: null },
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
      select: { totpSecret: true },
    });
    if (!user?.totpSecret) {
      return jsonError('Start TOTP setup before confirming a code', 400);
    }
    if (!(await verifyTotp(code, user.totpSecret))) {
      return jsonError('That code is not valid. Try the current one.', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpActivatedAt: new Date() },
    });

    const token = getSessionToken();
    if (token) await markSessionMfaVerified(token);

    return jsonOk({ ok: true });
  }

  // disable
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpActivatedAt: null },
  });
  return jsonOk({ ok: true });
}
