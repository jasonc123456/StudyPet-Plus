import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  ignoreCalendarEvent,
  unignoreCalendarEvent,
} from '@/lib/calendar-sync';
import { calendarIgnoreSchema, zodFirstError } from '@/lib/validators';

/** Mark a feed event "not an assignment" (a Zoom call, a lecture, an exam). */
export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = calendarIgnoreSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { subscriptionId, uid, title } = parsed.data;
  const result = await ignoreCalendarEvent(
    authResult.user.id,
    subscriptionId,
    uid,
    title
  );

  if (!result.ok) return jsonError(result.error, 404);
  return jsonOk({ success: true });
}

/** Undo an ignore — the next sync re-creates the assignment. */
export async function DELETE(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = calendarIgnoreSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const result = await unignoreCalendarEvent(
    authResult.user.id,
    parsed.data.subscriptionId,
    parsed.data.uid
  );

  if (!result.ok) return jsonError(result.error, 404);
  return jsonOk({ success: true });
}
