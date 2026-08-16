// Login-gate passkey challenge — step 2 (US-4.S1).
//
// Verifies the assertion against the stashed challenge and the stored public
// key, bumps the signature counter (clone detection), and marks the current
// session MFA-verified so the dashboard gate lets the user through.

import { NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

import { jsonError, jsonOk, requireUserPreMfa } from '@/lib/api-response';
import {
  expectedOrigin,
  getSessionToken,
  markSessionMfaVerified,
  parseTransports,
  rpID,
} from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import { consumeChallenge, WebAuthnCeremony } from '@/lib/webauthn-challenge';
import { passkeyAssertionSchema, zodFirstError } from '@/lib/validators';

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

  const parsed = passkeyAssertionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const response = parsed.data
    .response as unknown as AuthenticationResponseJSON;

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return jsonError('No active session', 401);
  }

  // Consumed before verification, so a challenge is spent whether or not the
  // assertion turns out to be good. A failed attempt costs a round-trip.
  const [matchesChallenge, authenticator] = await Promise.all([
    consumeChallenge(userId, sessionToken, WebAuthnCeremony.AUTHENTICATION),
    prisma.authenticator.findUnique({
      where: { credentialID: response.id },
    }),
  ]);

  if (!matchesChallenge) {
    return jsonError('Challenge expired — try again', 400);
  }
  if (!authenticator || authenticator.userId !== userId) {
    return jsonError('Unknown passkey', 400);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: matchesChallenge,
      expectedOrigin: expectedOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: false,
      credential: {
        id: authenticator.credentialID,
        publicKey: new Uint8Array(authenticator.publicKey),
        counter: authenticator.counter,
        transports: parseTransports(authenticator.transports) as
          AuthenticatorTransportFuture[] | undefined,
      },
    });
  } catch (error) {
    console.error('passkey auth verify', error);
    return jsonError('Could not verify this passkey', 400);
  }

  if (!verification.verified) {
    return jsonError('Passkey verification failed', 400);
  }

  await prisma.authenticator.update({
    where: { id: authenticator.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  const token = getSessionToken();
  if (token) await markSessionMfaVerified(token);

  return jsonOk({ ok: true });
}
