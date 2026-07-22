import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { createPersonalEventSchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createPersonalEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { title, description, startsAt, endsAt, allDay, color } = parsed.data;

  const event = await prisma.personalEvent.create({
    data: {
      userId: authResult.user.id,
      title,
      description: description || null,
      startsAt,
      endsAt,
      allDay,
      color,
    },
  });

  return jsonOk(event, 201);
}
