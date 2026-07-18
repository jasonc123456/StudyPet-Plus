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

import {
  getServerSession,
  type NextAuthOptions,
  type Provider,
} from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';

import { prisma } from '@/lib/prisma';

// True when Google OAuth is configured for this environment (US-4.S2). Kept
// optional so local/demo deploys without Google credentials still boot with
// magic-link sign-in only — the button on /login is hidden to match.
export const googleOAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const providers: Provider[] = [
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
    // Database sessions include the User row on `user`; expose id for
    // user-scoped planner CRUD (courses, assignments, etc.).
    session: ({ session, user }) => ({
      ...session,
      user: { ...session.user, id: user.id },
    }),
  },
};

// Server-side session getter — the v4 equivalent of v5's `auth()`. Use in
// server components / route handlers: `const session = await auth();`
export const auth = () => getServerSession(authOptions);
