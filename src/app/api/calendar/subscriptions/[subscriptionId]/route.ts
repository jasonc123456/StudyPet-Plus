import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  detachSubscriptionAssignments,
  syncUserCalendars,
} from '@/lib/calendar-sync';
import { prisma } from '@/lib/prisma';
import {
  updateCalendarSubscriptionSchema,
  zodFirstError,
} from '@/lib/validators';

function calendarTableMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.message === 'string' &&
    error.message.includes('CalendarSubscription')
  );
}

type RouteContext = {
  params: { subscriptionId: string };
};

/**
 * Update a connection — in practice, the auto-sync toggle.
 *
 * Turning autoSync on runs an immediate forced sync, so the tasks page is
 * already populated when the user navigates there. Turning it off removes the
 * untouched rows the sync created, keeping — and keeping linked — any the
 * student already started, so switching it back on updates them in place rather
 * than importing a second copy.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateCalendarSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  let existing;
  try {
    existing = await prisma.calendarSubscription.findFirst({
      where: { id: params.subscriptionId, userId: authResult.user.id },
      select: { id: true, autoSync: true },
    });
  } catch (error) {
    if (calendarTableMissing(error)) {
      return jsonError(
        'Calendar subscriptions need a database migration. Run `npx prisma migrate dev` locally first.',
        503
      );
    }
    throw error;
  }

  if (!existing) {
    return jsonError('Calendar connection not found', 404);
  }

  const { name, color, autoSync } = parsed.data;

  const updated = await prisma.calendarSubscription.update({
    where: { id: params.subscriptionId },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(autoSync !== undefined && { autoSync }),
    },
  });

  if (autoSync === true && !existing.autoSync) {
    await syncUserCalendars(authResult.user.id, { force: true });
  } else if (autoSync === false && existing.autoSync) {
    await detachSubscriptionAssignments(params.subscriptionId);
  }

  return jsonOk(updated);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let existing;
  try {
    existing = await prisma.calendarSubscription.findFirst({
      where: {
        id: params.subscriptionId,
        userId: authResult.user.id,
      },
      select: { id: true },
    });
  } catch (error) {
    if (calendarTableMissing(error)) {
      return jsonError(
        'Calendar subscriptions need a database migration. Run `npx prisma migrate dev` locally first.',
        503
      );
    }
    throw error;
  }

  if (!existing) {
    return jsonError('Calendar connection not found', 404);
  }

  try {
    await prisma.calendarSubscription.delete({
      where: { id: params.subscriptionId },
    });
  } catch (error) {
    if (calendarTableMissing(error)) {
      return jsonError(
        'Calendar subscriptions need a database migration. Run `npx prisma migrate dev` locally first.',
        503
      );
    }
    throw error;
  }

  return jsonOk({ success: true });
}
