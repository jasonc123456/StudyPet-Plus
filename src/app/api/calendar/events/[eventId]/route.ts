import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { updatePersonalEventSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { eventId: string };
};

async function getOwnedPersonalEvent(eventId: string, userId: string) {
  const event = await prisma.personalEvent.findUnique({
    where: { id: eventId },
  });
  return event && event.userId === userId ? event : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedPersonalEvent(
    params.eventId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Event not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updatePersonalEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { title, description, startsAt, endsAt, allDay, color } = parsed.data;

  const event = await prisma.personalEvent.update({
    where: { id: params.eventId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(startsAt !== undefined && { startsAt }),
      ...(endsAt !== undefined && { endsAt }),
      ...(allDay !== undefined && { allDay }),
      ...(color !== undefined && { color }),
    },
  });

  return jsonOk(event);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedPersonalEvent(
    params.eventId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Event not found', 404);
  }

  await prisma.personalEvent.delete({ where: { id: params.eventId } });

  return jsonOk({ success: true });
}
