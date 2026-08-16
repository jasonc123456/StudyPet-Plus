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

export type MfaGateState = {
  /** The user has at least one active second factor. */
  active: boolean;
  /** This session has already cleared that factor. */
  verified: boolean;
};

/**
 * The MFA gate state for the request's own session, in one query.
 *
 * Every authenticated API call runs this (see requireUser), so it reads the
 * session row and the two factor signals together rather than issuing the three
 * round-trips isMfaActive + isSessionMfaVerified would cost. A session token
 * that doesn't resolve, or resolves to a different user than the caller claims,
 * reports "no factor, not verified" — the 401 path owns that case.
 */
export async function getSessionMfaGateState(
  userId: string
): Promise<MfaGateState> {
  const token = getSessionToken();
  if (!token) return { active: false, verified: false };

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: {
      userId: true,
      mfaVerifiedAt: true,
      user: {
        select: {
          totpActivatedAt: true,
          _count: { select: { authenticators: true } },
        },
      },
    },
  });

  if (!session || session.userId !== userId) {
    return { active: false, verified: false };
  }

  return {
    active:
      Boolean(session.user.totpActivatedAt) ||
      session.user._count.authenticators > 0,
    verified: Boolean(session.mfaVerifiedAt),
  };
}

/**
 * Whether the request's session still needs to pass the MFA gate: the user has
 * a factor enrolled and this session has not yet cleared it. Returns false when
 * there is no session token (unauthenticated — handled elsewhere).
 */
export async function requiresMfaChallenge(userId: string): Promise<boolean> {
  const state = await getSessionMfaGateState(userId);
  return state.active && !state.verified;
}

// ---- TOTP guess throttling ----
//
// A six-digit code is a 1-in-a-million guess, which is only strong while the
// number of guesses is bounded. Nothing bounded them: the challenge route
// accepted codes as fast as they could be posted, so an attacker holding a
// primary session could simply enumerate. State lives on the User row rather
// than in memory so a restart, or a second replica, does not hand out a fresh
// allowance.

/** Consecutive failures tolerated before the account is locked out. */
export const TOTP_MAX_ATTEMPTS = 5;
/** How long a lockout lasts once tripped. */
export const TOTP_LOCKOUT_MS = 15 * 60 * 1000;

export type TotpLockout = { locked: boolean; retryAfterSeconds: number };

/** Whether TOTP verification is currently locked out for this user. */
export function totpLockoutState(lockedUntil: Date | null): TotpLockout {
  if (!lockedUntil) return { locked: false, retryAfterSeconds: 0 };

  const remainingMs = lockedUntil.getTime() - Date.now();
  if (remainingMs <= 0) return { locked: false, retryAfterSeconds: 0 };

  return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

/**
 * Count a wrong code. Trips a lockout on the threshold and resets the counter,
 * so the next lockout needs another full run of failures.
 */
export async function recordTotpFailure(
  userId: string,
  currentAttempts: number
): Promise<TotpLockout> {
  const attempts = currentAttempts + 1;

  if (attempts >= TOTP_MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + TOTP_LOCKOUT_MS);
    await prisma.user.update({
      where: { id: userId },
      data: { totpFailedAttempts: 0, totpLockedUntil: lockedUntil },
    });
    return totpLockoutState(lockedUntil);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpFailedAttempts: attempts },
  });
  return { locked: false, retryAfterSeconds: 0 };
}

/** Clear throttling state after a code verifies. */
export async function clearTotpFailures(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { totpFailedAttempts: 0, totpLockedUntil: null },
  });
}
