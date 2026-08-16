// Passkey registration — step 1 of 2 (US-4.S1).
//
// Returns WebAuthn creation options for the browser's navigator.credentials
// ceremony and stashes the one-time challenge on the user so the verify step
// can check it. Already-registered credentials are excluded so the same device
// can't be enrolled twice.

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getSessionToken, parseTransports, RP_NAME, rpID } from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import { storeChallenge, WebAuthnCeremony } from '@/lib/webauthn-challenge';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

export async function POST() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user.id;

  try {
    const existing = await prisma.authenticator.findMany({
      where: { userId },
      select: { credentialID: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpID(),
      userID: new TextEncoder().encode(userId),
      userName: authResult.user.email ?? userId,
      attestationType: 'none',
      excludeCredentials: existing.map((cred) => ({
        id: cred.credentialID,
        transports: parseTransports(cred.transports) as
          AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return jsonError('No active session', 401);
    }

    await storeChallenge(
      userId,
      sessionToken,
      WebAuthnCeremony.REGISTRATION,
      options.challenge
    );

    return jsonOk(options);
  } catch (error) {
    console.error('POST /api/mfa/passkey/register/options', error);
    return jsonError('Failed to start passkey registration', 500);
  }
}
