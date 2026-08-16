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

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
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
 * Best-effort client address, taken from the proxy header nginx sets.
 *
 * X-Forwarded-For is client-controlled if the app is ever exposed directly, so
 * this must never be used for authorization — only for coarse throttling, where
 * a spoofed value costs the attacker their own shared bucket.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Test seam — the map is module state that would otherwise leak between runs. */
export function resetRateLimits() {
  windows.clear();
}
