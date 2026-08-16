// Who may spend AI provider credit, and how much.
//
// Two separate problems live here.
//
// The first is the demo account. /api/demo-login hands any anonymous visitor a
// normal application session, and every AI route accepted that session like any
// other — so with real provider keys configured, a stranger could drive paid
// generation on repeat without ever creating an account. The demo now always
// gets the canned material, whatever AI_DEMO_MODE says, so demo traffic cannot
// reach a provider at all.
//
// The second is authenticated users, who can still spend real money. They get a
// daily allowance and a concurrency cap.
//
// The counters are per-process, like src/lib/rate-limit.ts and with the same
// caveat: across replicas the effective limit multiplies, and a restart forgives
// the day's usage. That is a cost guard rail, not a billing system — provider-
// side spend limits are the real backstop.

import { DEMO_EMAIL } from '@/lib/demo-account';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

/** Generations one account may run per day. */
const DAILY_GENERATION_LIMIT = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Generations one account may have in flight at once. */
const MAX_CONCURRENT_PER_USER = 2;
/** Generations the whole process may have in flight at once. */
const MAX_CONCURRENT_GLOBAL = 8;

const inFlightByUser = new Map<string, number>();
let inFlightTotal = 0;

export type AiEntitlement = {
  /** True when this caller must be served canned content, never a provider. */
  demoOnly: boolean;
};

export class AiBudgetError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = 'AiBudgetError';
  }
}

/** Whether this user is the shared public demo account. */
export async function isDemoAccount(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return user?.email === DEMO_EMAIL;
}

/**
 * Claim a generation slot for `userId`.
 *
 * Returns the entitlement to generate under, and a `release` that must be called
 * when the generation finishes — use try/finally. Throws AiBudgetError when the
 * caller is over their allowance or the process is saturated.
 */
export async function claimAiGeneration(userId: string): Promise<{
  entitlement: AiEntitlement;
  release: () => void;
}> {
  const demoOnly = await isDemoAccount(userId);

  // Canned generation costs nothing upstream, so the demo account is not metered
  // — it is simply never allowed to reach a provider.
  if (demoOnly) {
    return { entitlement: { demoOnly: true }, release: () => {} };
  }

  const daily = rateLimit(
    `ai-generate:${userId}`,
    DAILY_GENERATION_LIMIT,
    DAY_MS
  );
  if (!daily.ok) {
    throw new AiBudgetError(
      'You have reached the daily limit for AI generation. Try again tomorrow.',
      daily.retryAfterSeconds
    );
  }

  const userInFlight = inFlightByUser.get(userId) ?? 0;
  if (userInFlight >= MAX_CONCURRENT_PER_USER) {
    throw new AiBudgetError(
      'Another generation is already running. Wait for it to finish.',
      5
    );
  }
  if (inFlightTotal >= MAX_CONCURRENT_GLOBAL) {
    throw new AiBudgetError(
      'The server is busy generating right now. Try again in a moment.',
      15
    );
  }

  inFlightByUser.set(userId, userInFlight + 1);
  inFlightTotal += 1;

  let released = false;
  const release = () => {
    if (released) return; // a double release would corrupt the counters
    released = true;

    const remaining = (inFlightByUser.get(userId) ?? 1) - 1;
    if (remaining <= 0) inFlightByUser.delete(userId);
    else inFlightByUser.set(userId, remaining);

    inFlightTotal = Math.max(0, inFlightTotal - 1);
  };

  return { entitlement: { demoOnly: false }, release };
}
