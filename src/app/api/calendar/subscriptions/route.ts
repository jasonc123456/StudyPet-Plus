import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { verifyIcsFeed } from '@/lib/calendar';
import { prisma } from '@/lib/prisma';
import {
  createCalendarSubscriptionSchema,
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

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let subscriptions;
  try {
    subscriptions = await prisma.calendarSubscription.findMany({
      where: { userId: authResult.user.id },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    if (calendarTableMissing(error)) {
      return jsonOk([]);
    }
    throw error;
  }

  return jsonOk(subscriptions);
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createCalendarSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { name, icsUrl, color } = parsed.data;

  let existing;
  try {
    existing = await prisma.calendarSubscription.findUnique({
      where: {
        userId_icsUrl: {
          userId: authResult.user.id,
          icsUrl,
        },
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

  if (existing) {
    return jsonError('This ICS calendar is already connected', 409);
  }

  const feedCheck = await verifyIcsFeed(icsUrl);
  if (!feedCheck.ok) {
    return jsonError(feedCheck.error, 400);
  }

  let subscription;
  try {
    subscription = await prisma.calendarSubscription.create({
      data: {
        userId: authResult.user.id,
        name,
        icsUrl,
        color,
      },
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

  return jsonOk(subscription, 201);
}
