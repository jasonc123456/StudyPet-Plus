import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  ignoreCalendarEvent,
  unignoreCalendarEvent,
} from '@/lib/calendar-sync';
import { calendarIgnoreSchema, zodFirstError } from '@/lib/validators';

/** Mark a feed event "not an assignment", or with asMeeting, a meeting. */
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

  const { subscriptionId, uid, title, asMeeting } = parsed.data;
  const result = await ignoreCalendarEvent(
    authResult.user.id,
    subscriptionId,
    uid,
    title,
    asMeeting
  );

  if (!result.ok) return jsonError(result.error, 404);
  return jsonOk({ success: true });
}

/** "Track as task": undo an ignore or opt a meeting in, then re-sync. */
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
    parsed.data.uid,
    parsed.data.title
  );

  if (!result.ok) return jsonError(result.error, 404);
  return jsonOk({ success: true });
}
