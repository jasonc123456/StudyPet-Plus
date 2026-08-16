// The canonical public origin, and absolute URLs built on it.
//
// Never derive these from the incoming request. Behind the nginx proxy the
// Next.js server only ever sees its internal bind address, so
// `new URL(request.url).origin` yields something like http://0.0.0.0:3000 —
// which is not reachable by anyone. Any link handed to a user (an emailed
// confirmation, a calendar feed URL, a URL embedded in an exported ICS file)
// must come from NEXTAUTH_URL instead. This mirrors how Auth.js builds its
// magic-link callbacks.

/** The public origin, with any trailing slash removed. */
export function siteOrigin(): string {
  return (process.env.NEXTAUTH_URL ?? '').replace(/\/+$/, '');
}

/** An absolute URL on the canonical public origin. */
export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** True when the canonical public origin is HTTPS. */
export function isSecureOrigin(): boolean {
  return siteOrigin().startsWith('https://');
}

/**
 * Refuse to serve production over a plaintext origin.
 *
 * Session cookies, magic links and MFA all cross this origin, so an http://
 * NEXTAUTH_URL in production means a network-positioned attacker can read or
 * replace any of them. The checked-in Compose stack terminates nothing itself
 * — nginx there is the internal hop behind a TLS terminator (see README) — so
 * nothing else in the repo would catch a deployment published on plain HTTP.
 *
 * Throwing is deliberate: this is a misconfiguration that cannot be safely
 * degraded around, and failing at startup surfaces it before any user does.
 * Development is exempt, where http://localhost is normal and fine.
 */
export function assertSecureOriginInProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const origin = siteOrigin();

  if (!origin) {
    throw new Error(
      'NEXTAUTH_URL is not set. Production requires the canonical https:// origin.'
    );
  }

  if (!isSecureOrigin()) {
    throw new Error(
      `NEXTAUTH_URL must be https:// in production (got "${origin}"). ` +
        'Terminate TLS in front of this app and set NEXTAUTH_URL to the public HTTPS origin.'
    );
  }
}
