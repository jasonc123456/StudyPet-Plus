// Edge middleware — first-line gate for /dashboard routes.
//
// StudyPet+ uses NextAuth v4 with database-backed sessions (not JWT cookies),
// so we check for a session cookie here and let server components run the full
// `auth()` lookup. Unauthenticated visitors are redirected to /login; public
// routes (landing, login, auth callbacks, health, demo-login) are outside the
// matcher and are never touched.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  '__Host-next-auth.session-token',
];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

export function middleware(request: NextRequest) {
  if (!hasSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
