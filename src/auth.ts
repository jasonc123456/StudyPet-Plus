// Auth.js (NextAuth v5) configuration for StudyPet+.
//
// Exposes `signIn`/`signOut` (used by the login page server action), `auth`
// (read the session in server components / route handlers / middleware), and
// `handlers` (wired up in app/api/auth/[...nextauth]/route.ts).
//
// Sign-in is passwordless magic-link email via Nodemailer. The Prisma adapter
// persists users + one-time verification tokens, so sessions are database
// backed. All secrets come from the deploy environment:
//   AUTH_SECRET   - session/JWT signing secret
//   DATABASE_URL  - Postgres connection (consumed by prisma.ts)
//   EMAIL_SERVER  - SMTP connection string, e.g. smtp://user:pass@host:587
//   EMAIL_FROM    - From: address on magic-link emails

import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // The email provider requires the database session strategy (it stores
  // verification tokens via the adapter), which is the default when an adapter
  // is present — stated explicitly here for clarity.
  session: { strategy: "database" },
  // We deploy off-Vercel, so Auth.js can't infer the host from VERCEL_URL.
  // Trust the host header (kept safe by AUTH_SECRET + the magic-link token).
  trustHost: true,
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/login",
    // Where users land after submitting their email ("we sent you a link").
    verifyRequest: "/login/verify-request",
  },
});
