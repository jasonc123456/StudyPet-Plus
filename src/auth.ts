// Auth.js (NextAuth v4 — stable) configuration for StudyPet+.
//
// Exposes `authOptions` (the shared config, passed to NextAuth() in the route
// handler and to getServerSession() on the server) and `auth()` — a small
// helper that reads the database-backed session in server components.
//
// Sign-in is passwordless magic-link email. The Prisma adapter persists users +
// one-time verification tokens, so sessions are database backed. Secrets come
// from the deploy environment (see .env / .env.example):
//   NEXTAUTH_SECRET      - session signing secret
//   NEXTAUTH_URL         - canonical site URL (magic-link callback origin)
//   DATABASE_URL         - Postgres connection (consumed by prisma.ts)
//   EMAIL_SERVER_HOST/PORT/USER/PASSWORD - SMTP transport for the magic links
//   EMAIL_FROM           - From: address on magic-link emails

import { getServerSession, type NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';

import { recordAuthEvent } from '@/lib/auth-events';
import { prisma } from '@/lib/prisma';

// True when Google OAuth is configured for this environment (US-4.S2). Kept
// optional so local/demo deploys without Google credentials still boot with
// magic-link sign-in only — the button on /login is hidden to match.
export const googleOAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const providers: NextAuthOptions['providers'] = [
  EmailProvider({
    // Build the SMTP transport from the discrete EMAIL_SERVER_* env vars
    // already set in .env (Office 365, STARTTLS on 587).
    server: {
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    },
    from: process.env.EMAIL_FROM,
  }),
];

if (googleOAuthEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // A magic-link user and a Google sign-in with the same Google-verified
      // email resolve to one account instead of erroring with
      // OAuthAccountNotLinked. Safe here because Google asserts the email.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // The email provider stores verification tokens via the adapter, so use the
  // database session strategy (the default when an adapter is present).
  session: { strategy: 'database' },
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  pages: {
    signIn: '/login',
    // Where users land after submitting their email ("we sent you a link").
    verifyRequest: '/login/verify-request',
  },
  callbacks: {
    /**
     * Last gate before a session is minted.
     *
     * A suspended account must not be able to sign back in — otherwise
     * suspension only lasts until the user clicks a fresh magic link, which is
     * no suspension at all. Refusing here (rather than only in requireUser)
     * means no Session row is created for them in the first place.
     *
     * Unknown addresses are allowed through: the Email provider creates the
     * user on first verification, so "no row yet" is the normal signup path,
     * not a rejection.
     */
    async signIn({ user, account }) {
      const email = user?.email?.toLowerCase() ?? null;
      const method = account?.provider ?? null;

      if (!email) return true;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, suspendedAt: true },
      });

      if (existing?.suspendedAt) {
        await recordAuthEvent({
          type: 'SIGN_IN_FAILED',
          userId: existing.id,
          email,
          method,
          detail: 'Account suspended',
        });
        // Sends the user to /login?error=AccessDenied rather than a blank stop.
        return false;
      }

      return true;
    },

    // Database sessions include the User row on `user`; expose id for
    // user-scoped planner CRUD (courses, assignments, etc.).
    session: ({ session, user }) => ({
      ...session,
      user: { ...session.user, id: user.id },
    }),
  },

  /**
   * Authentication history for the admin console.
   *
   * These fire after Auth.js has already decided, so nothing here can change
   * the outcome — and recordAuthEvent swallows its own failures, so a logging
   * problem cannot turn a good sign-in into a bad one. The address and user
   * agent are read from the ambient request headers, which are available
   * because these run inside the /api/auth/* route handler.
   */
  events: {
    async signIn({ user, account, isNewUser }) {
      await recordAuthEvent({
        type: 'SIGN_IN',
        userId: user?.id ?? null,
        email: user?.email ?? null,
        method: account?.provider ?? null,
        detail: isNewUser ? 'First sign-in (account created)' : null,
      });
    },

    async signOut({ session }) {
      // The database-session variant hands us the Session row, not a JWT.
      const userId =
        session && 'userId' in session ? (session.userId as string) : null;
      if (!userId) return;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      await recordAuthEvent({
        type: 'SIGN_OUT',
        userId,
        email: user?.email ?? null,
      });
    },
  },
};

// Server-side session getter — the v4 equivalent of v5's `auth()`. Use in
// server components / route handlers: `const session = await auth();`
export const auth = () => getServerSession(authOptions);
