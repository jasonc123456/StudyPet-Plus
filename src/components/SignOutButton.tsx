'use client';

// NextAuth v4 sign-out is client-side. Small client component so the dashboard
// can stay a server component (which reads the session via `auth()`).

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      className="btn-primary"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Sign out
    </button>
  );
}
