// Multi-factor auth core (US-4.S1).
//
// Two second factors sit on top of the passwordless magic-link / Google login:
//   * TOTP  — an authenticator-app 6-digit code (otplib).
//   * Passkey — a WebAuthn credential (@simplewebauthn/server).
//
// A user is "MFA active" once they activate TOTP or register a passkey. When
// active, a freshly signed-in session must clear the second factor before it
// can reach the app; that state lives in Session.mfaVerifiedAt and is enforced
// by the dashboard layout gate. This module owns the crypto, the relying-party
// config, and the session-token <-> MFA-state plumbing.

import { cookies } from 'next/headers';
import { generateSecret, generateURI, verify } from 'otplib';

import { prisma } from '@/lib/prisma';

// NextAuth session cookie names, in the order it prefers them (secure first on
// HTTPS). Mirrors src/middleware.ts.
const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  '__Host-next-auth.session-token',
  'next-auth.session-token',
];

export const TOTP_ISSUER = 'StudyPet+';

// Allow a step of clock drift in either direction (±30s) when checking codes.
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

// ---------------------------------------------------------------------------
// Relying-party config (WebAuthn)
// ---------------------------------------------------------------------------

export const RP_NAME = 'StudyPet+';

/** Origin the browser reports in a WebAuthn ceremony, e.g. https://studypetplus.app. */
export function expectedOrigin(): string {
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

/**
 * WebAuthn Relying Party ID — the registrable domain, no scheme or port.
 * Derived from NEXTAUTH_URL (localhost -> "localhost", https://studypetplus.app
 * -> "studypetplus.app"); override with MFA_RP_ID if the app is served from a
 * subdomain that should share credentials with the apex.
 */
export function rpID(): string {
  if (process.env.MFA_RP_ID) return process.env.MFA_RP_ID;
  try {
    return new URL(expectedOrigin()).hostname;
  } catch {
    return 'localhost';
  }
}

// ---------------------------------------------------------------------------
// TOTP
// ---------------------------------------------------------------------------

export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI an authenticator app scans (also encodable as a QR). */
export function buildOtpAuthUrl(secret: string, accountName: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: accountName, secret });
}

export async function verifyTotp(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    const result = await verify({
      token: token.replace(/\s+/g, ''),
      secret,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Transports helpers (WebAuthn stores a hint list as a comma-joined string)
// ---------------------------------------------------------------------------

export function serializeTransports(
  transports: readonly string[] | undefined
): string | null {
  return transports && transports.length ? transports.join(',') : null;
}

export function parseTransports(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const list = value.split(',').filter(Boolean);
  return list.length ? list : undefined;
}

// ---------------------------------------------------------------------------
// User factor state
// ---------------------------------------------------------------------------

export type MfaFactors = {
  totpActivated: boolean;
  passkeys: Array<{
    id: string;
    deviceName: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
};

export async function getMfaFactors(userId: string): Promise<MfaFactors> {
  const [user, passkeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { totpActivatedAt: true },
    }),
    prisma.authenticator.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        deviceName: true,
        createdAt: true,
        lastUsedAt: true,
      },
    }),
  ]);

  return {
    totpActivated: Boolean(user?.totpActivatedAt),
    passkeys,
  };
}

/** True when the user has at least one active second factor. */
export async function isMfaActive(userId: string): Promise<boolean> {
  const factors = await getMfaFactors(userId);
  return factors.totpActivated || factors.passkeys.length > 0;
}

// ---------------------------------------------------------------------------
// Session <-> MFA verification state
// ---------------------------------------------------------------------------

/** Reads the current NextAuth session token from the request cookies (server). */
export function getSessionToken(): string | null {
  const jar = cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (value) return value;
  }
  return null;
}

/** True when the session identified by `sessionToken` has cleared MFA. */
export async function isSessionMfaVerified(
  sessionToken: string
): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: { mfaVerifiedAt: true },
  });
  return Boolean(session?.mfaVerifiedAt);
}

/** Marks the current session as having cleared the second factor. */
export async function markSessionMfaVerified(
  sessionToken: string
): Promise<void> {
  await prisma.session.updateMany({
    where: { sessionToken },
    data: { mfaVerifiedAt: new Date() },
  });
}

/**
 * Whether the request's session still needs to pass the MFA gate: the user has
 * a factor enrolled and this session has not yet cleared it. Returns false when
 * there is no session token (unauthenticated — handled elsewhere).
 */
export async function requiresMfaChallenge(userId: string): Promise<boolean> {
  if (!(await isMfaActive(userId))) return false;
  const token = getSessionToken();
  if (!token) return false;
  return !(await isSessionMfaVerified(token));
}
