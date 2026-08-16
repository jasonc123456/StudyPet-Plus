// The authentication guard for Server Actions.
//
// API routes get this from requireUser() in api-response.ts, which returns a
// NextResponse on failure. Server Actions can't use it: they return plain
// objects to the client, not Responses. That difference is exactly how the MFA
// gate came to be missing here — the routes were fixed centrally and the actions,
// calling auth() directly, kept the old behaviour: a session that had entered a
// password but never cleared its second factor could still generate flashcards
// and mutate the account's decks.
//
// So the same policy lives here in the shape actions need. Any exported action
// that touches user data calls this, never auth() — src/lib/action-auth.test.ts
// fails the build if that slips.

import { auth } from '@/auth';
import { requiresMfaChallenge } from '@/lib/mfa';

export type ActionAuthError = {
  ok: false;
  error: string;
  code: 'UNAUTHORIZED' | 'MFA_REQUIRED';
};

export type ActionAuthResult = { ok: true; userId: string } | ActionAuthError;

/**
 * Resolve the acting user, or explain why there isn't one.
 *
 * Deny-by-default in the same sense as requireUser(): an account with a second
 * factor configured is refused until this session has actually cleared it.
 */
export async function requireActionUser(): Promise<ActionAuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      ok: false,
      error: 'You must be signed in.',
      code: 'UNAUTHORIZED',
    };
  }

  if (await requiresMfaChallenge(session.user.id)) {
    return {
      ok: false,
      error: 'Two-factor verification is required before continuing.',
      code: 'MFA_REQUIRED',
    };
  }

  return { ok: true, userId: session.user.id };
}
