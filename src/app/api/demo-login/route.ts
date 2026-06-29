// One-click demo login — no email round-trip.
//
// StudyPet+ uses passwordless magic-link auth, so there's no password to post.
// Instead this handler mints a real database-backed NextAuth session for the
// shared demo user and sets the session cookie, exactly like a normal sign-in
// would. `auth()` (getServerSession) then resolves it on every page.
//
// Reached via the "🚀 Try the demo" button on the landing page.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

// Always run on the server per request — never cache (it sets a cookie).
export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo@studypetplus.corecrafted.net";
const DEMO_NAME = "Demo Student";
const SESSION_DAYS = 30;

export async function GET(request: Request) {
  // Upsert so the demo works even on a fresh DB that hasn't been seeded.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: DEMO_NAME, emailVerified: new Date() },
  });

  // A NextAuth database session is just a random token + expiry tied to a user.
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  // On HTTPS, NextAuth reads the __Secure- prefixed cookie; match that exactly
  // so getServerSession() picks up the session we just created.
  const useSecure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const cookieName = useSecure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  // Redirect to the dashboard on the canonical site origin.
  const base = process.env.NEXTAUTH_URL ?? request.url;
  const res = NextResponse.redirect(new URL("/dashboard", base));
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecure,
    expires,
  });
  return res;
}
