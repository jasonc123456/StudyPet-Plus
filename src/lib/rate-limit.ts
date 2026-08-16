// A small fixed-window rate limiter for endpoints that do real work before any
// authentication has happened.
//
// In-memory on purpose: StudyPet+ runs as a single Next process behind nginx
// (see docker-compose.yml), so one map is the whole picture. If the app is ever
// scaled to multiple replicas this becomes per-replica and the effective limit
// multiplies by the replica count — at that point it needs to move to Postgres
// or Redis. It is a speed bump against amplification, not a security boundary,
// and nothing else should be built on it.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Stop the map growing without bound when keys are attacker-supplied (IPs). */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Drop expired windows, then — if that wasn't enough — the ones expiring
 * soonest, until the map is back under its cap.
 *
 * Expiry alone is not a bound. Keys come from client addresses, and a caller
 * rotating the forwarded chain mints a fresh live window per request; sweeping
 * only what had already expired left the map growing for as long as the burst
 * lasted. Evicting live windows can hand an attacker a fresh allowance, but a
 * limiter that stays within its memory budget is the more important half.
 */
function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }

  if (windows.size <= MAX_TRACKED_KEYS) return;

  const byExpiry = [...windows.entries()].sort(
    (a, b) => a[1].resetAt - b[1].resetAt
  );
  for (const [key] of byExpiry.slice(0, windows.size - MAX_TRACKED_KEYS)) {
    windows.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets. Suitable for a Retry-After header. */
  retryAfterSeconds: number;
};

/**
 * Count one hit against `key` and say whether it is allowed.
 *
 * Fixed windows, not a sliding log: a caller can land up to 2x the limit across
 * a window boundary. That is a fine trade here — the point is to stop unbounded
 * amplification, not to meter precisely.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000)
  );

  return { ok: existing.count <= limit, retryAfterSeconds };
}

/**
 * How many X-Forwarded-For entries were appended by our own infrastructure,
 * counting from the right.
 *
 * Each proxy appends the address it heard from, so the chain reads
 * "<whatever the client sent>, <client>, <proxy>, <proxy>…". Reading the
 * left-most entry — which is what this did — reads the part the client wrote,
 * so a caller could mint a new rate-limit identity per request just by varying
 * a header. Counting in from the right instead lands on the address a proxy we
 * trust actually observed.
 *
 * The live chain is Cloudflare -> Nginx Proxy Manager -> nginx -> app: NPM
 * appends Cloudflare's address and nginx appends NPM's, so two entries sit to
 * the right of the real client and this is 2. A stack with no proxy in front
 * leaves it at 0.
 */
const TRUSTED_PROXY_HOPS = Math.max(
  0,
  Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '0', 10) || 0
);

/**
 * The client address as reported by the last proxy we trust.
 *
 * Only for coarse throttling, never authorization. When the chain is shorter
 * than the configured hop count the request did not arrive the way we expect,
 * so it gets a single shared bucket rather than a spoofable identity — that
 * throttles harder, which is the safe direction to be wrong in.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');

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
    return request.headers.get('x-real-ip')?.trim() || 'unknown';
  }

  return 'unverified';
}

/** Test seam — the map is module state that would otherwise leak between runs. */
export function resetRateLimits() {
  windows.clear();
}
