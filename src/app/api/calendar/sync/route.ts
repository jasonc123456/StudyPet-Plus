import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { syncUserCalendars } from '@/lib/calendar-sync';
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
export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  // An empty body is the common case (the auto-trigger sends nothing).
  const body = await request.json().catch(() => ({}));
  const parsed = calendarSyncSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
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
