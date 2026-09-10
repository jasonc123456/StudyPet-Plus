// Working out who a request actually came from.
//
// This used to live in rate-limit.ts alone, and when the admin console needed
// the same answer for its sign-in log the logic got copied. Two copies of
// "which header do we trust" is exactly the kind of duplication that drifts
// into a security hole — one gets hardened, the other doesn't — so both now
// call in here.
//
// Two strategies, in order:
//
//   1. Cloudflare's CF-Connecting-IP, when TRUST_CLOUDFLARE_CLIENT_IP is on.
//      Cloudflare overwrites this header at its edge on every request, so it is
//      exact and it does not shift when the number of proxies behind it changes.
//
//   2. Counting in from the right of X-Forwarded-For by TRUSTED_PROXY_HOPS.
//      Each proxy appends the address it heard from, so the chain reads
//      "<whatever the client sent>, <client>, <proxy>, <proxy>…". Reading the
//      left-most entry reads the part the *client* wrote, which is forgeable;
//      counting from the right lands on what a proxy we trust observed.
//
// THE CAVEAT ON STRATEGY 1: CF-Connecting-IP is only trustworthy if the origin
// cannot be reached except through Cloudflare. Anyone who can talk to the
// origin directly can set that header to whatever they like, and turning this
// on would then let them forge their address in the audit log and dodge
// per-IP throttling. Enable it only alongside an origin firewall that accepts
// Cloudflare's ranges (or an authenticated origin pull). Off by default for
// exactly that reason — the safe setting is the one you get by doing nothing.

/** True when the value looks like a deliberate opt-in. */
function boolFromEnv(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

/**
 * Prefer Cloudflare's CF-Connecting-IP over positional X-Forwarded-For parsing.
 *
 * Read at module load from .env, like the other deployment limits.
 */
export const TRUST_CLOUDFLARE_CLIENT_IP = boolFromEnv(
  'TRUST_CLOUDFLARE_CLIENT_IP',
  false
);

/**
 * How many X-Forwarded-For entries our own infrastructure appended, counting
 * from the right.
 *
 * The live chain is Cloudflare -> Nginx Proxy Manager -> nginx -> app: NPM
 * appends Cloudflare's address and nginx appends NPM's, so two entries sit to
 * the right of the real client and this is 2. A stack with no proxy in front
 * leaves it at 0.
 *
 * Still consulted when TRUST_CLOUDFLARE_CLIENT_IP is on: it is the fallback
 * for any request that arrives without a CF-Connecting-IP header.
 */
export const TRUSTED_PROXY_HOPS = Math.max(
  0,
  Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '0', 10) || 0
);

/** Reads one header, case-insensitively. Both Headers and next/headers fit. */
export type HeaderReader = (name: string) => string | null | undefined;

/**
 * The client address, as well as this deployment can know it.
 *
 * Returns 'unverified' when the request did not arrive the way we expect —
 * a chain shorter than the configured hop count, say. That is deliberately a
 * single shared value rather than a guess: for throttling it buckets the
 * unexpected traffic together (throttling harder, the safe direction to be
 * wrong in), and for the audit log it records honestly that we could not tell.
 */
export function resolveClientIp(getHeader: HeaderReader): string {
  if (TRUST_CLOUDFLARE_CLIENT_IP) {
    const cloudflare = getHeader('cf-connecting-ip')?.trim();
    if (cloudflare) return cloudflare;
  }

  const forwarded = getHeader('x-forwarded-for');

  if (forwarded) {
    const chain = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const index = chain.length - 1 - TRUSTED_PROXY_HOPS;
    if (index >= 0) return chain[index]!;

    return 'unverified';
  }

  // Set by our own nginx from the connection, so it is only meaningful when
  // nothing else is in front. With proxies configured, prefer a shared bucket.
  if (TRUSTED_PROXY_HOPS === 0) {
    return getHeader('x-real-ip')?.trim() || 'unknown';
  }

  return 'unverified';
}
