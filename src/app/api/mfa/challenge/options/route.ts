// Login-gate passkey challenge — step 1 (US-4.S1).
//
// Generates WebAuthn authentication options limited to the user's registered
// credentials and stashes the challenge for the verify step. Used by the /mfa
// gate when the user chooses "Use a passkey".

import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { parseTransports, rpID } from '@/lib/mfa';
import { prisma } from '@/lib/prisma';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

export async function POST() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user.id;

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

  await prisma.user.update({
    where: { id: userId },
    data: { currentChallenge: options.challenge },
  });

  return jsonOk(options);
}
