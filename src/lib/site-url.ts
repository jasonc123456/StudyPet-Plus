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
