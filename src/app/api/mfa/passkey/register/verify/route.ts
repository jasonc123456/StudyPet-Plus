// Passkey registration — step 2 of 2 (US-4.S1).
//
// Verifies the browser's attestation against the challenge stashed in step 1,
// then persists the new credential.
//
// Registration proves possession of the *new* credential, which says nothing
// about the factor already on the account. Two things keep that from being a
// bypass: requireUser() refuses a session that hasn't cleared the existing
// factor, and the session is marked MFA-verified below only when this passkey
// is the account's first factor — otherwise enrolling an attacker-controlled
// key would have been enough to clear the gate on its own.

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
import { consumeChallenge, WebAuthnCeremony } from '@/lib/webauthn-challenge';
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

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return jsonError('No active session', 401);
  }

  const [user, matchesChallenge] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpActivatedAt: true,
        _count: { select: { authenticators: true } },
      },
    }),
    consumeChallenge(userId, sessionToken, WebAuthnCeremony.REGISTRATION),
  ]);
  if (!user) {
    return jsonError('Passkey setup expired — start again', 400);
  }
  if (!matchesChallenge) {
    return jsonError('Passkey setup expired — start again', 400);
  }

  // Read before the write below: was the account unprotected until now?
  const isFirstFactor =
    !user.totpActivatedAt && user._count.authenticators === 0;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as unknown as RegistrationResponseJSON,
      expectedChallenge: matchesChallenge,
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

  await prisma.authenticator.create({
    data: {
      userId,
      credentialID: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: serializeTransports(credential.transports),
      deviceName: parsed.data.deviceName?.trim() || 'Passkey',
    },
  });

  // Only the first factor clears the gate, and only because there was nothing
  // to prove a moment ago — without this the user would be bounced to /mfa the
  // instant they finished enrolling. A session enrolling an *additional* key
  // already passed requireUser(), so it is verified regardless.
  if (isFirstFactor) {
    const token = getSessionToken();
    if (token) await markSessionMfaVerified(token);
  }

  return jsonOk({ ok: true }, 201);
}
