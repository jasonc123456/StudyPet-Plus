import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

import { auth } from '@/auth';
import { requiresMfaChallenge } from '@/lib/mfa';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type AuthedUser = { user: NonNullable<Session['user']> };

/**
 * The first factor only: a signed-in session, MFA cleared or not.
 *
 * Deliberately narrow. Only the endpoints that *are* the second-factor
 * challenge may use this — a session sitting at the /mfa gate has to be able to
 * submit its TOTP code or passkey assertion. Everything else uses requireUser.
 * `src/lib/api-response.test.ts` fails the build if that allowlist grows.
 */
export async function requireUserPreMfa(): Promise<AuthedUser | NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonError('Unauthorized', 401);
  }

  return { user: session.user };
}

/**
 * Returns the session user or an error response — never both.
 *
 * MFA is deny-by-default here, not just in the dashboard layout. Before this,
 * the layout redirected an unverified session to /mfa while the very same
 * cookie sailed through every API route, so a first-factor-only attacker could
 * read notes, download attachments, and rewrite the account's second factor by
 * calling the API directly. The gate belongs in the shared guard, where a new
 * route inherits it by default instead of having to remember it.
 *
 * A user with no factor enrolled is not gated (nothing to prove), so first-time
 * enrollment still works.
 */
export async function requireUser(): Promise<AuthedUser | NextResponse> {
  const result = await requireUserPreMfa();
  if (result instanceof NextResponse) return result;

  if (await requiresMfaChallenge(result.user.id)) {
    return jsonError('Two-factor verification required', 403);
  }

  return result;
}
