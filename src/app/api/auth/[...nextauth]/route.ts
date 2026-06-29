// NextAuth (v4) catch-all route handler.
//
// Auth.js needs HTTP endpoints under /api/auth/* (sign-in, the magic-link
// verification callback the emailed link points at, sign-out, session, ...).
// In the App Router, NextAuth(authOptions) returns a handler we re-export as
// both GET and POST.

import NextAuth from 'next-auth';

import { authOptions } from '@/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
