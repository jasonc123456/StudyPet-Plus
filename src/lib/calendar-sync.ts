// Auto-sync: materialize ICS feed events as Assignment rows.
//
// Only subscriptions with autoSync=true are pulled. Each feed event is keyed by
// (subscriptionId, uid), so re-running is idempotent — a second sync updates the
// same rows instead of duplicating them. The user's own edits to `status` are
// never overwritten; the feed owns title/description/dueAt.
//
// Two things are deliberately skipped:
//   - recurring events (RRULE), which are lectures/sections, not deliverables
//   - UIDs in CalendarIgnoredEvent, which the user marked "not an assignment"

import { fetchIcsEvents, type ParsedIcsEvent } from '@/lib/calendar';
import {
  cleanIcsText,
  guessAssignmentType,
  parseCourseCode,
} from '@/lib/calendar-text';
import { prisma } from '@/lib/prisma';

/** How far back/forward from today we materialize feed events. */
const WINDOW_DAYS_PAST = 30;
const WINDOW_DAYS_FUTURE = 270;

/** A sync triggered by a page view is skipped if one ran this recently. */
const SYNC_THROTTLE_MS = 10 * 60 * 1000;

export type SubscriptionSyncResult = {
  subscriptionId: string;
  name: string;
  created: number;
  updated: number;
  removed: number;
  skipped: boolean;
  error: string | null;
};

export type CalendarSyncResult = {
  subscriptions: SubscriptionSyncResult[];
  /** Total rows written — the client only refreshes when this is non-zero. */
  changed: number;
};

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/**
 * Resolve the course a feed event belongs to, creating it on first sight.
 * Canvas titles carry the course code ("HW2 [CSE-102-01]"); events without one
 * fall back to a single course named after the subscription.
 *
 * `cache` is per-sync-run so a 40-event feed does one lookup per course, and two
 * events with the same code can't race each other into two identical courses.
 */
async function resolveCourseId(
  userId: string,
  courseCode: string | null,
  fallbackName: string,
  color: string,
  cache: Map<string, string>
) {
  const name = courseCode ?? fallbackName;
  const cacheKey = name.toLowerCase();

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const existing = await prisma.course.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });

  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  const created = await prisma.course.create({
    data: { userId, name, color },
    select: { id: true },
  });

  cache.set(cacheKey, created.id);
  return created.id;
}

/** Assignment fields the feed owns. Status and course stay under user control. */
function assignmentFieldsFor(event: ParsedIcsEvent) {
  const { title } = parseCourseCode(
    cleanIcsText(event.summary) || event.summary
  );
  const description = cleanIcsText(event.description);

  return {
    title,
    description: description || null,
    dueAt: event.startsAt,
  };
}

async function syncSubscription(
  subscription: {
    id: string;
    userId: string;
    name: string;
    icsUrl: string;
    color: string;
    lastSyncedAt: Date | null;
  },
  force: boolean
): Promise<SubscriptionSyncResult> {
  const base = {
    subscriptionId: subscription.id,
    name: subscription.name,
    created: 0,
    updated: 0,
    removed: 0,
    skipped: false,
    error: null as string | null,
  };

  const isFresh =
    subscription.lastSyncedAt !== null &&
    Date.now() - subscription.lastSyncedAt.getTime() < SYNC_THROTTLE_MS;

  if (!force && isFresh) {
    return { ...base, skipped: true };
  }

  let feedEvents: ParsedIcsEvent[];
  try {
    feedEvents = await fetchIcsEvents(subscription.icsUrl);
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : 'Calendar sync failed',
    };
  }

  const now = new Date();
  const windowStart = addDays(now, -WINDOW_DAYS_PAST);
  const windowEnd = addDays(now, WINDOW_DAYS_FUTURE);

  const [ignored, existingRows] = await Promise.all([
    prisma.calendarIgnoredEvent.findMany({
      where: { subscriptionId: subscription.id },
      select: { uid: true },
    }),
    prisma.assignment.findMany({
      where: { calendarSubscriptionId: subscription.id },
      select: { id: true, externalUid: true, status: true, dueAt: true },
    }),
  ]);

  const ignoredUids = new Set(ignored.map((row) => row.uid));
  const existingByUid = new Map(
    existingRows.flatMap((row) =>
      row.externalUid ? [[row.externalUid, row]] : []
    )
  );

  // Every UID the feed still knows about, window or not — deletions below key off
  // this, so an assignment outside the window is never mistaken for "removed".
  const feedUids = new Set(feedEvents.map((event) => event.uid));

  const syncable = feedEvents.filter(
    (event) =>
      !event.rrule &&
      !ignoredUids.has(event.uid) &&
      event.startsAt >= windowStart &&
      event.startsAt <= windowEnd
  );

  const courseCache = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const event of syncable) {
    const fields = assignmentFieldsFor(event);
    const existing = existingByUid.get(event.uid);

    if (existing) {
      await prisma.assignment.update({
        where: { id: existing.id },
        data: fields,
      });
      updated += 1;
      continue;
    }

    const cleanSummary = cleanIcsText(event.summary) || event.summary;
    const { courseCode } = parseCourseCode(cleanSummary);
    const courseId = await resolveCourseId(
      subscription.userId,
      courseCode,
      subscription.name,
      subscription.color,
      courseCache
    );

    await prisma.assignment.create({
      data: {
        ...fields,
        courseId,
        type: guessAssignmentType(fields.title),
        calendarSubscriptionId: subscription.id,
        externalUid: event.uid,
      },
    });
    created += 1;
  }

  // Dropped from the feed upstream. Only untouched ("todo") rows go — anything
  // the student started or finished stays as their record of the work.
  const staleIds = existingRows
    .filter(
      (row) =>
        row.externalUid !== null &&
        !feedUids.has(row.externalUid) &&
        row.status === 'todo' &&
        row.dueAt !== null &&
        row.dueAt >= windowStart &&
        row.dueAt <= windowEnd
    )
    .map((row) => row.id);

  if (staleIds.length > 0) {
    await prisma.assignment.deleteMany({ where: { id: { in: staleIds } } });
  }

  await prisma.calendarSubscription.update({
    where: { id: subscription.id },
    data: { lastSyncedAt: new Date() },
  });

  return { ...base, created, updated, removed: staleIds.length };
}

/**
 * Sync every auto-sync-enabled feed for a user. Safe to call on every calendar
 * page view: throttled to one upstream pull per feed per 10 minutes unless
 * `force` is set (the "Sync now" button).
 */
export async function syncUserCalendars(
  userId: string,
  { force = false }: { force?: boolean } = {}
): Promise<CalendarSyncResult> {
  const subscriptions = await prisma.calendarSubscription.findMany({
    where: { userId, autoSync: true },
    select: {
      id: true,
      userId: true,
      name: true,
      icsUrl: true,
      color: true,
      lastSyncedAt: true,
    },
  });

  // Sequential: feeds share the course cache's create-then-read pattern only
  // within a run, but two feeds racing on the same course code would still
  // double-create. Feeds per user are few; correctness beats the parallelism.
  const results: SubscriptionSyncResult[] = [];
  for (const subscription of subscriptions) {
    results.push(await syncSubscription(subscription, force));
  }

  const changed = results.reduce(
    (total, result) => total + result.created + result.updated + result.removed,
    0
  );

  return { subscriptions: results, changed };
}

/**
 * Mark a feed event "not an assignment": record the UID so future syncs skip it,
 * and drop the assignment row this sync already created (unless the student has
 * started it — then we leave their work alone and just stop re-creating it).
 */
export async function ignoreCalendarEvent(
  userId: string,
  subscriptionId: string,
  uid: string,
  title: string
) {
  const subscription = await prisma.calendarSubscription.findFirst({
    where: { id: subscriptionId, userId },
    select: { id: true },
  });

  if (!subscription)
    return { ok: false as const, error: 'Calendar connection not found' };

  await prisma.calendarIgnoredEvent.upsert({
    where: { subscriptionId_uid: { subscriptionId, uid } },
    create: { subscriptionId, uid, title },
    update: { title },
  });

  await prisma.assignment.deleteMany({
    where: {
      calendarSubscriptionId: subscriptionId,
      externalUid: uid,
      status: 'todo',
    },
  });

  return { ok: true as const };
}

/** Undo an ignore. The next sync re-creates the assignment. */
export async function unignoreCalendarEvent(
  userId: string,
  subscriptionId: string,
  uid: string
) {
  const subscription = await prisma.calendarSubscription.findFirst({
    where: { id: subscriptionId, userId },
    select: { id: true },
  });

  if (!subscription)
    return { ok: false as const, error: 'Calendar connection not found' };

  await prisma.calendarIgnoredEvent.deleteMany({
    where: { subscriptionId, uid },
  });

  return { ok: true as const };
}

/**
 * Turning auto-sync off removes the rows it created, so the assignments page
 * returns to exactly what the student entered by hand. Started/finished work is
 * kept and simply unlinked from the feed.
 */
export async function detachSubscriptionAssignments(subscriptionId: string) {
  await prisma.assignment.deleteMany({
    where: { calendarSubscriptionId: subscriptionId, status: 'todo' },
  });

  await prisma.assignment.updateMany({
    where: { calendarSubscriptionId: subscriptionId },
    data: { calendarSubscriptionId: null, externalUid: null },
  });
}
