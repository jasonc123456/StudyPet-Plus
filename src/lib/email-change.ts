// Shared helpers for the "verify before changing your email" flow. The create
// side (PUT /api/profile) and the confirm side (GET /api/profile/email/verify)
// both need the same token hashing, so it lives here to stay in lock-step.

import { createHash, randomBytes } from 'crypto';

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

/** Absolute URL clicked from the confirmation email. */
export function buildEmailChangeVerifyUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL ?? '').replace(/\/+$/, '');
  return `${base}/api/profile/email/verify?token=${token}`;
}
