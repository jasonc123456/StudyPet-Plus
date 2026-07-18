// Passkey registration — step 2 of 2 (US-4.S1).
//
// Verifies the browser's attestation against the challenge stashed in step 1,
// then persists the new credential. Registering a passkey also clears the
// current session's MFA gate: the user just proved possession.

import { NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  expectedOrigin,
  getSessionToken,
  markSessionMfaVerified,
  rpID,
  serializeTransports,
} from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import { passkeyRegisterSchema, zodFirstError } from '@/lib/validators';

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

  const parsed = passkeyRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentChallenge: true },
  });
  if (!user?.currentChallenge) {
    return jsonError('Passkey setup expired — start again', 400);
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as unknown as RegistrationResponseJSON,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: false,
    });
  } catch (error) {
    console.error('passkey register verify', error);
    return jsonError('Could not verify this passkey', 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return jsonError('Passkey verification failed', 400);
  }

  const { credential } = verification.registrationInfo;

  await prisma.$transaction([
    prisma.authenticator.create({
      data: {
        userId,
        credentialID: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: serializeTransports(credential.transports),
        deviceName: parsed.data.deviceName?.trim() || 'Passkey',
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { currentChallenge: null },
    }),
  ]);

  const token = getSessionToken();
  if (token) await markSessionMfaVerified(token);

  return jsonOk({ ok: true }, 201);
}
