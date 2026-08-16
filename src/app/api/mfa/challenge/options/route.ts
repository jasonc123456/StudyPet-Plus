// Login-gate passkey challenge — step 1 (US-4.S1).
//
// Generates WebAuthn authentication options limited to the user's registered
// credentials and stashes the challenge for the verify step. Used by the /mfa
// gate when the user chooses "Use a passkey".

import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

import { jsonError, jsonOk, requireUserPreMfa } from '@/lib/api-response';
import { getSessionToken, parseTransports, rpID } from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import { storeChallenge, WebAuthnCeremony } from '@/lib/webauthn-challenge';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

export async function POST() {
  const authResult = await requireUserPreMfa();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user.id;

  try {
    const credentials = await prisma.authenticator.findMany({
      where: { userId },
      select: { credentialID: true, transports: true },
    });

    if (credentials.length === 0) {
      return jsonError('No passkeys registered', 400);
    }

    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      userVerification: 'preferred',
      allowCredentials: credentials.map((cred) => ({
        id: cred.credentialID,
        transports: parseTransports(cred.transports) as
          AuthenticatorTransportFuture[] | undefined,
      })),
    });

    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return jsonError('No active session', 401);
    }

    await storeChallenge(
      userId,
      sessionToken,
      WebAuthnCeremony.AUTHENTICATION,
      options.challenge
    );

    return jsonOk(options);
  } catch (error) {
    console.error('POST /api/mfa/challenge/options', error);
    return jsonError('Failed to start passkey challenge', 500);
  }
}
