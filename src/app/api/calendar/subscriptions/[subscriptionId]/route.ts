import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

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
