// Signing in as another user, and getting back out again.
//
// This is the most dangerous thing the console can do, so the mechanics are
// deliberately narrow:
//
//   * The impersonated session is a real Session row, marked with
//     impersonatedByUserId. Nothing else in the app has to learn a new auth
//     path, and any code that reads a session can tell the difference.
//
//   * It is short-lived (IMPERSONATION_TTL_MINUTES), independent of the normal
//     session lifetime. An admin who wanders off does not leave a live session
//     for someone else's account open for a month.
//
//   * The admin's own session token is parked in a separate httpOnly cookie
//     rather than being destroyed, so "stop impersonating" restores the real
//     session instead of forcing a fresh sign-in — which is what makes admins
//     actually use the stop button.
//
//   * mfaVerifiedAt is pre-set on the minted session. The target's second
//     factor belongs to the target; an admin cannot produce it, and the gate
//     would otherwise trap the session at /mfa with no way forward. The
//     protection that matters here is that only an existing admin could reach
//     this code at all, plus the audit row every call writes.
//
// Both the start and the stop are recorded in AuthEvent *and* AdminAuditLog:
// the target's own activity view shows that it happened to them, and the audit
// trail shows who did it.

import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';

/** How long a minted impersonation session stays valid. */
export const IMPERSONATION_TTL_MINUTES = 30;

/** Where the admin's real session token waits while they are impersonating. */
export const IMPERSONATOR_COOKIE = 'studypet.impersonator-session';

// Mirrors src/lib/mfa.ts — the order Auth.js prefers when reading.
const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  '__Host-next-auth.session-token',
  'next-auth.session-token',
];

/**
 * The cookie name Auth.js will *write* in this deployment.
 *
 * It prefixes with __Secure- only on HTTPS; setting that prefix on plain HTTP
 * makes the browser drop the cookie silently, which would look like "sign-in
 * did nothing" in local development.
 */
export function sessionCookieName(): string {
  const secure = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
  return secure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
}

function secureCookies(): boolean {
  return (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
}

/** The session token this request is carrying, whichever cookie name holds it. */
export function currentSessionToken(): string | null {
  const jar = cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (value) return value;
  }
  return null;
}

/** Auth.js session tokens are opaque random strings; match that shape. */
function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export type ImpersonationState = {
  /** The user whose account the browser is currently acting as. */
  targetUserId: string;
  /** The admin who started it. */
  adminUserId: string;
};

/**
 * Whether the request's session is an impersonation, and by whom.
 *
 * Read by the dashboard layout to raise the banner. Returns null for an
 * ordinary session, which is the common case, so it stays a single indexed
 * lookup on the session token.
 */
export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const token = currentSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { userId: true, impersonatedByUserId: true },
  });

  if (!session?.impersonatedByUserId) return null;

  return {
    targetUserId: session.userId,
    adminUserId: session.impersonatedByUserId,
  };
}

/**
 * Mint an impersonation session for `targetUserId` and swap the browser onto it.
 *
 * The caller is responsible for having checked that the actor is an admin and
 * that the target is a legitimate one — see requireAdmin and guardTarget.
 */
export async function startImpersonation(
  adminUserId: string,
  targetUserId: string
): Promise<void> {
  const adminToken = currentSessionToken();
  const sessionToken = newSessionToken();
  const expires = new Date(Date.now() + IMPERSONATION_TTL_MINUTES * 60 * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId: targetUserId,
      expires,
      impersonatedByUserId: adminUserId,
      // See the header comment: the admin cannot satisfy someone else's factor.
      mfaVerifiedAt: new Date(),
    },
  });

  const jar = cookies();

  if (adminToken) {
    jar.set(IMPERSONATOR_COOKIE, adminToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies(),
      path: '/',
      // Outliving the impersonation session on purpose: if the short session
      // expires while the admin is still in it, the way back must still work.
      maxAge: 60 * 60 * 12,
    });
  }

  jar.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    expires,
  });
}

/**
 * Hand the browser back its original admin session.
 *
 * Returns the admin's user id when it worked, or null when this session was not
 * an impersonation (or the parked token has since expired — in which case the
 * impersonation session is still torn down and the user lands at /login rather
 * than being left holding someone else's account).
 */
export async function stopImpersonation(): Promise<string | null> {
  const token = currentSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    select: { sessionToken: true, impersonatedByUserId: true },
  });

  if (!session?.impersonatedByUserId) return null;

  const jar = cookies();
  const adminToken = jar.get(IMPERSONATOR_COOKIE)?.value ?? null;

  // Delete first: whatever happens with the cookies below, the borrowed session
  // must not survive this call.
  await prisma.session
    .delete({ where: { sessionToken: session.sessionToken } })
    .catch(() => undefined);

  jar.delete(IMPERSONATOR_COOKIE);

  const restored = adminToken
    ? await prisma.session.findUnique({
        where: { sessionToken: adminToken },
        select: { expires: true },
      })
    : null;

  if (adminToken && restored && restored.expires > new Date()) {
    jar.set(sessionCookieName(), adminToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies(),
      path: '/',
      expires: restored.expires,
    });
  } else {
    // No usable admin session to go back to — leave the browser signed out
    // rather than signed in as the target.
    jar.delete(sessionCookieName());
  }

  return session.impersonatedByUserId;
}
