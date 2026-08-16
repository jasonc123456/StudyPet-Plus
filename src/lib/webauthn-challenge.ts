// One-time, session-bound storage for WebAuthn ceremony challenges.
//
// Both ceremonies — registering a passkey and signing in with one — used to
// write to a single `currentChallenge` column on the user. That one slot was
// shared by every tab, device and ceremony type the account had open, so
// starting either ceremony destroyed any other already in flight. Anyone
// holding a pre-MFA session could keep a legitimate passkey sign-in from ever
// completing, simply by asking for registration options in a loop.
//
// A challenge is now a row keyed by the session that started it and the ceremony
// it belongs to, with an expiry, and it is consumed exactly once.

import { createHash, timingSafeEqual } from 'node:crypto';

import { WebAuthnCeremony } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export { WebAuthnCeremony };

/** How long the browser has to finish a ceremony. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function hashChallenge(challenge: string): string {
  return createHash('sha256').update(challenge).digest('hex');
}

/**
 * Record a challenge for this session and ceremony, replacing any earlier one
 * for the same pair — restarting your own ceremony is fine; what must not happen
 * is one session's ceremony clearing another's.
 */
export async function storeChallenge(
  userId: string,
  sessionToken: string,
  ceremony: WebAuthnCeremony,
  challenge: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const challengeHash = hashChallenge(challenge);

  await prisma.webAuthnChallenge.upsert({
    where: { sessionToken_ceremony: { sessionToken, ceremony } },
    create: { userId, sessionToken, ceremony, challengeHash, expiresAt },
    update: { userId, challengeHash, expiresAt },
  });

  // Opportunistic cleanup; abandoned ceremonies are common and tiny.
  await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

/**
 * Take this session's challenge for `ceremony`, if it has a live one.
 *
 * Consuming is a delete that must affect exactly one row, so two requests racing
 * the same challenge cannot both proceed. Returns a matcher rather than the
 * value: only a hash is stored, so verification hashes whatever the browser
 * echoed back and compares that.
 */
export async function consumeChallenge(
  userId: string,
  sessionToken: string,
  ceremony: WebAuthnCeremony
): Promise<((challenge: string) => boolean) | null> {
  const row = await prisma.webAuthnChallenge.findUnique({
    where: { sessionToken_ceremony: { sessionToken, ceremony } },
  });

  if (!row || row.userId !== userId || row.expiresAt <= new Date()) {
    return null;
  }

  const { count } = await prisma.webAuthnChallenge.deleteMany({
    where: { id: row.id },
  });
  if (count !== 1) return null;

  return (challenge: string) => {
    const presented = Buffer.from(hashChallenge(challenge), 'hex');
    const expected = Buffer.from(row.challengeHash, 'hex');
    return (
      presented.length === expected.length &&
      timingSafeEqual(presented, expected)
    );
  };
}
