import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { syncUserCalendars } from '@/lib/calendar-sync';
import { rateLimit } from '@/lib/rate-limit';
import { calendarSyncSchema, zodFirstError } from '@/lib/validators';

function calendarTableMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.message === 'string' &&
    error.message.includes('Calendar')
  );
}

/**
 * Pull every auto-sync feed for the signed-in user into their assignments.
 *
 * Called two ways: automatically when the calendar page mounts (throttled to one
 * upstream pull per feed per 10 minutes), and with `{ force: true }` from the
 * "Sync now" button.
 */
/** Comfortably above what the UI's "Sync now" button can produce by hand. */
const FORCED_SYNC_LIMIT = 10;
const FORCED_SYNC_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  // An empty body is the common case (the auto-trigger sends nothing).
  const body = await request.json().catch(() => ({}));
  const parsed = calendarSyncSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  // Only forced syncs need a limiter: an unforced one is already throttled to
  // one upstream pull per feed per 10 minutes, while `force` deliberately skips
  // that and would otherwise let a caller pull every feed as fast as they liked.
  if (parsed.data.force) {
    const limit = rateLimit(
      `calendar-sync:${authResult.user.id}`,
      FORCED_SYNC_LIMIT,
      FORCED_SYNC_WINDOW_MS
    );
    if (!limit.ok) {
      return jsonError('Syncing too often. Try again shortly.', 429, {
        'Retry-After': String(limit.retryAfterSeconds),
      });
    }
  }

  try {
    const result = await syncUserCalendars(authResult.user.id, {
      force: parsed.data.force,
    });
    return jsonOk(result);
  } catch (error) {
    if (calendarTableMissing(error)) {
      return jsonError(
        'Calendar sync needs a database migration. Run `npx prisma migrate dev` locally first.',
        503
      );
    }
    throw error;
  }
}
