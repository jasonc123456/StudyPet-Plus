// Shared helpers for the "verify before changing your email" flow. The create
// side (PUT /api/profile), the confirm page, and the apply side
// (POST /api/profile/email/verify) all need the same token hashing and URL
// building, so it lives here to stay in lock-step.

import { createHash, randomBytes } from 'crypto';

import { absoluteUrl } from '@/lib/site-url';

// How long a confirmation link stays valid. Short by design — an email change
// is a sensitive, deliberate action, not something left pending for days.
export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** A fresh random link token plus the hash we persist for it. */
export function createEmailChangeToken() {
  // 32 bytes = 256 bits of entropy; infeasible to guess.
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashEmailChangeToken(token) };
}

/** SHA-256 the raw link token. We only ever store/query the hash. */
export function hashEmailChangeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Re-exported so the existing callers here keep their import site; the helper
// itself is shared (see site-url.ts for why request.url must not be used).
export { absoluteUrl };

// The link mailed to the new address points at a confirmation PAGE, not a
// state-changing endpoint. Loading it only reads — so Office 365 "Safe Links"
// scanning and browser prefetchers that follow the link can't consume the
// one-time token or silently apply the change. The switch happens only when the
// user submits the confirm form (a POST) on that page.
export function buildEmailChangeConfirmUrl(token: string): string {
  return absoluteUrl(`/email-change/confirm?token=${token}`);
}
