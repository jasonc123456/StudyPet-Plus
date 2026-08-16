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
// The daily allowance is counted in the database (AiUsage), one row per account
// per local calendar day. It started out in the in-memory limiter next door in
// src/lib/rate-limit.ts, which was fine while nobody saw the number; the
// sidebar meter shows it, and an in-memory count silently resets to zero on
// every deploy. Concurrency is still per-process — it is a measure of what this
// container is doing right now, so process memory is the correct place for it,
// with the same caveat that across replicas the effective ceiling multiplies.
//
// None of this is a billing system. Provider-side spend limits are the real
// backstop.

import { DEMO_EMAIL } from '@/lib/demo-account';
import { localDayKey, nextLocalMidnight } from '@/lib/local-day';
import { prisma } from '@/lib/prisma';

/**
 * Limits, overridable per deployment.
 *
 * Read at module load from .env, which `next start` loads via @next/env — so a
 * change takes effect on the next build-and-swap without recreating the
 * container, the same as TRUSTED_PROXY_HOPS. A missing, unparseable, or
 * non-positive value falls back to the default rather than disabling the limit.
 */
function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Generations one account may run per local day. */
export const DAILY_GENERATION_LIMIT = limitFromEnv(
  'AI_DAILY_GENERATION_LIMIT',
  60
);
/** Generations one account may have in flight at once. */
const MAX_CONCURRENT_PER_USER = limitFromEnv('AI_MAX_CONCURRENT_PER_USER', 2);
/** Generations the whole process may have in flight at once. */
const MAX_CONCURRENT_GLOBAL = limitFromEnv('AI_MAX_CONCURRENT_GLOBAL', 8);

const inFlightByUser = new Map<string, number>();
let inFlightTotal = 0;

export type AiEntitlement = {
  /** True when this caller must be served canned content, never a provider. */
  demoOnly: boolean;
};

export type AiUsageSnapshot = {
  /** True when this account is the shared demo and has no allowance to spend. */
  demoOnly: boolean;
  /** Generations spent on the account's current local day. */
  used: number;
  /** Generations allowed per local day. */
  limit: number;
  /** When the count rolls over — the account's next local midnight, ISO. */
  resetAt: string;
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

type UsageContext = {
  demoOnly: boolean;
  day: string;
  resetAt: Date;
};

/**
 * The account's demo status and its current local day, in one read.
 *
 * Both answers come off the same User row, so they are fetched together rather
 * than making the claim path pay for two round trips.
 */
async function usageContext(userId: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, timezone: true },
  });

  return {
    demoOnly: user?.email === DEMO_EMAIL,
    day: localDayKey(now, user?.timezone),
    resetAt: nextLocalMidnight(now, user?.timezone),
  } satisfies UsageContext;
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
 * Today's usage for `userId` without spending any of it.
 *
 * This is what the sidebar meter reads. It deliberately does not create a row:
 * an account that has generated nothing today has no row, and that reads as 0.
 */
export async function getAiUsage(userId: string): Promise<AiUsageSnapshot> {
  const { demoOnly, day, resetAt } = await usageContext(userId);

  if (demoOnly) {
    return {
      demoOnly: true,
      used: 0,
      limit: DAILY_GENERATION_LIMIT,
      resetAt: resetAt.toISOString(),
    };
  }

  const row = await prisma.aiUsage.findUnique({
    where: { userId_day: { userId, day } },
    select: { count: true },
  });

  return {
    demoOnly: false,
    // A row can sit above the limit only if the limit was lowered mid-day;
    // clamp so the meter never renders past full.
    used: Math.min(row?.count ?? 0, DAILY_GENERATION_LIMIT),
    limit: DAILY_GENERATION_LIMIT,
    resetAt: resetAt.toISOString(),
  };
}

/**
 * Add `delta` to today's count and return the new total.
 *
 * One statement, so two generations starting at the same moment cannot both
 * read 59 and both write 60. Prisma's upsert would issue a SELECT then an
 * INSERT and lose that race, hence the raw ON CONFLICT.
 */
async function addToDailyCount(
  userId: string,
  day: string,
  delta: number
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AiUsage" ("userId", "day", "count", "updatedAt")
    VALUES (${userId}, ${day}, ${delta}, NOW())
    ON CONFLICT ("userId", "day")
    DO UPDATE SET "count" = "AiUsage"."count" + ${delta}, "updatedAt" = NOW()
    RETURNING "count"
  `;

  return rows[0]?.count ?? 0;
}

/**
 * Claim a generation slot for `userId`.
 *
 * Returns the entitlement to generate under, and a `release` that must be called
 * when the generation finishes — use try/finally. Throws AiBudgetError when the
 * caller is over their allowance or the process is saturated.
 *
 * The daily count is spent on the attempt, not on success: a generation that
 * fails at the provider has still cost a call. Only the concurrency slot is
 * given back by `release`.
 */
export async function claimAiGeneration(userId: string): Promise<{
  entitlement: AiEntitlement;
  release: () => void;
}> {
  const { demoOnly, day } = await usageContext(userId);

  // Canned generation costs nothing upstream, so the demo account is not metered
  // — it is simply never allowed to reach a provider.
  if (demoOnly) {
    return { entitlement: { demoOnly: true }, release: () => {} };
  }

  const used = await addToDailyCount(userId, day, 1);
  if (used > DAILY_GENERATION_LIMIT) {
    // Hand the slot straight back so a rejected attempt does not push the count
    // further past the limit on every retry.
    await addToDailyCount(userId, day, -1);
    throw new AiBudgetError(
      'You have reached the daily limit for AI generation. Try again tomorrow.',
      60
    );
  }

  const userInFlight = inFlightByUser.get(userId) ?? 0;
  const overUserConcurrency = userInFlight >= MAX_CONCURRENT_PER_USER;
  const overGlobalConcurrency = inFlightTotal >= MAX_CONCURRENT_GLOBAL;

  if (overUserConcurrency || overGlobalConcurrency) {
    // Refused before doing any work, so this one did not cost a call.
    await addToDailyCount(userId, day, -1);
    throw new AiBudgetError(
      overUserConcurrency
        ? 'Another generation is already running. Wait for it to finish.'
        : 'The server is busy generating right now. Try again in a moment.',
      overUserConcurrency ? 5 : 15
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
