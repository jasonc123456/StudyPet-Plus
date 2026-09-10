// The authentication event log that backs the admin console's sign-in activity.
//
// Before this, an account's authentication history did not exist anywhere. The
// Session table says who holds a live session, but it is replaced on the next
// sign-in, it records no origin, and a *failed* attempt never wrote a row at
// all — so neither "when did this user last sign in, and from where" nor "is
// someone hammering this address" could be answered. Both are the first things
// an administrator asks.
//
// Two rules shape this module:
//
//   * Logging must never break authentication. Every write is best-effort and
//     swallows its error — a full disk or a lock timeout must not stop a
//     legitimate user from signing in, and the log is diagnostic, not a
//     ledger anything else depends on.
//
//   * ip/userAgent are personal data, so they are not kept forever.
//     pruneAuthEvents() drops rows past the retention window.

import { headers } from 'next/headers';

import { prisma } from '@/lib/prisma';
import type { AuthEventType } from '@prisma/client';

/**
 * How long authentication rows are kept, in days. Overridable per deployment;
 * a missing or unusable value falls back to 90 rather than to "forever", so a
 * typo cannot silently turn this into unbounded retention of IP addresses.
 */
export const AUTH_EVENT_RETENTION_DAYS = (() => {
  const parsed = Number.parseInt(
    process.env.AUTH_EVENT_RETENTION_DAYS ?? '',
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
})();

// Mirrors the trusted-hop handling in src/lib/rate-limit.ts. Duplicated as a
// header-map reader rather than imported because Auth.js events hand us no
// Request object — see requestContext() below.
const TRUSTED_PROXY_HOPS = Math.max(
  0,
  Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '0', 10) || 0
);

/** A user agent long enough to be abuse rather than information. */
const MAX_USER_AGENT = 512;

export type AuthEventInput = {
  type: AuthEventType;
  userId?: string | null;
  email?: string | null;
  /** "email", "google", "totp", "passkey", "impersonation". */
  method?: string | null;
  detail?: string | null;
  /** Supply when the caller has a Request; otherwise the ambient headers win. */
  ip?: string | null;
  userAgent?: string | null;
};

function ipFromChain(forwarded: string | null, realIp: string | null): string {
  if (forwarded) {
    const chain = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const index = chain.length - 1 - TRUSTED_PROXY_HOPS;
    if (index >= 0) return chain[index]!;

    // Shorter chain than configured: the request did not arrive the way we
    // expect, so record that rather than a value an attacker chose.
    return 'unverified';
  }

  if (TRUSTED_PROXY_HOPS === 0) return realIp?.trim() || 'unknown';
  return 'unverified';
}

/**
 * Address and user agent of the request in flight.
 *
 * Auth.js v4 events receive no Request, but they run inside the App Router
 * handler for /api/auth/*, where next/headers is readable. Outside a request
 * scope headers() throws, so this returns nulls instead of taking the caller
 * down with it.
 */
export function requestContext(): {
  ip: string | null;
  userAgent: string | null;
} {
  try {
    const h = headers();
    return {
      ip: ipFromChain(h.get('x-forwarded-for'), h.get('x-real-ip')),
      userAgent: h.get('user-agent')?.slice(0, MAX_USER_AGENT) ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Write one authentication event. Never throws.
 *
 * Callers pass ip/userAgent when they hold a Request; otherwise the ambient
 * request headers are read. `email` is stored even when userId is known, so the
 * row still names the address after the account is deleted (userId is
 * ON DELETE SET NULL).
 */
export async function recordAuthEvent(input: AuthEventInput): Promise<void> {
  try {
    const ambient =
      input.ip === undefined || input.userAgent === undefined
        ? requestContext()
        : { ip: null, userAgent: null };

    await prisma.authEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        email: input.email?.toLowerCase() ?? null,
        method: input.method ?? null,
        detail: input.detail ?? null,
        ip: input.ip === undefined ? ambient.ip : input.ip,
        userAgent:
          input.userAgent === undefined
            ? ambient.userAgent
            : (input.userAgent?.slice(0, MAX_USER_AGENT) ?? null),
      },
    });
  } catch {
    // Diagnostic data is never worth failing a sign-in over.
  }
}

/**
 * Drop authentication rows past the retention window.
 *
 * Called opportunistically from the admin activity view rather than on a timer:
 * this deployment has no scheduler, and a cron that only exists in one replica
 * is a retention promise that quietly stops being kept. Returns the number
 * removed. Never throws.
 */
export async function pruneAuthEvents(): Promise<number> {
  try {
    const cutoff = new Date(
      Date.now() - AUTH_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const { count } = await prisma.authEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  } catch {
    return 0;
  }
}
