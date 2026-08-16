import { Prisma } from '@prisma/client';

import { cleanIcsText } from '@/lib/calendar-text';
import { isMissingGroupTables } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { fetchPublicText, SafeFetchError } from '@/lib/safe-fetch';

export type CalendarEventSource =
  'assignment' | 'quest' | 'group_task' | 'imported' | 'personal';

export type CalendarEvent = {
  id: string;
  source: CalendarEventSource;
  sourceId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  status: string | null;
  color: string;
  description: string | null;
  href: string | null;
  meta: string | null;
  /** Set on assignment-backed events; addresses the status API. Null otherwise. */
  courseId: string | null;
  /** Set on group-task events; addresses the group-task status API. Null otherwise. */
  groupId: string | null;
  // Feed provenance. Set on imported events and on the assignments auto-sync
  // created from them; together (subscriptionId, uid) address one feed event,
  // which is what the ignore + un-ignore actions post back to the API.
  uid: string | null;
  subscriptionId: string | null;
  /** The user marked this feed event "not an assignment". */
  ignored: boolean;
  /** This event is backed by an Assignment row created by auto-sync. */
  autoSynced: boolean;
};

export type CalendarTask = {
  id: string;
  source: 'assignment' | 'quest' | 'group_task';
  sourceId: string;
  title: string;
  dueAt: Date;
  status: string;
  href: string;
  courseId?: string;
  groupId?: string;
  meta: string | null;
};

export type CalendarSubscriptionWithError = {
  id: string;
  name: string;
  icsUrl: string;
  color: string;
  autoSync: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;
  /** Assignments currently materialized from this feed. */
  syncedCount: number;
  /** Feed events the user marked "not an assignment". */
  ignoredCount: number;
};

export type CalendarPageData = {
  month: Date;
  selectedDate: Date;
  gridStart: Date;
  gridEnd: Date;
  events: CalendarEvent[];
  eventsByDay: Record<string, CalendarEvent[]>;
  selectedDayEvents: CalendarEvent[];
  subscriptions: CalendarSubscriptionWithError[];
  /**
   * Feed events from auto-sync connections with no assignment row yet. Non-zero
   * means the page is rendering "Imported" events that *should* already be
   * tasks, so the client's arrival sync forces past the throttle.
   */
  pendingSyncCount: number;
  /**
   * The user's persisted preference: when true the group-task events above are
   * every dated task across their groups, not just the ones assigned to them.
   * Drives the "Show all group tasks" toggle's initial state.
   */
  showAllGroupTasks: boolean;
  /** True once the user has generated an outbound ICS link. The URL itself is unrecoverable. */
  hasCalendarFeedToken: boolean;
};

export type ParsedIcsEvent = {
  uid: string;
  summary: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  rrule: string | null;
};

const ICAL_DAY_KEYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const DEFAULT_IMPORTED_COLOR = '#0ea5e9';

// A feed is third-party bytes fetched over the network, so everything below
// treats it as hostile input. The safeguards guard against denial-of-service,
// not correctness: a malformed or malicious feed must fail or truncate, never
// hang the process or exhaust its memory.

/** Cap on candidate occurrences one RRULE may generate (see expandRecurringEvent). */
const MAX_RECURRENCE_STEPS = 1000;
/** Cap on VEVENTs parsed from one feed. A real Canvas term is a few hundred. */
const MAX_FEED_EVENTS = 5000;
/** Cap on feed download size. A large Canvas feed is well under 1 MB. */
const MAX_ICS_BYTES = 5 * 1024 * 1024;

/** A recurrence field parsed to a positive integer, or null if absent/garbage. */
function positiveIntOrNull(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Math.floor(Number(raw));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Deadlines for a feed fetch. Both halves matter: a publisher that never sends
 * headers is caught by the first, and one that trickles the body a byte at a
 * time — staying under MAX_ICS_BYTES indefinitely — is caught by the second.
 * Before these existed, either shape could hold a render or a sync worker open
 * for as long as the publisher cared to.
 */
const FEED_HEADERS_TIMEOUT_MS = 8_000;
const FEED_TOTAL_TIMEOUT_MS = 20_000;

const FEED_REQUEST_HEADERS = {
  accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.8',
};

/**
 * Fetch a feed through the hardened outbound client.
 *
 * Everything about SSRF and resource limits lives in safe-fetch: per-hop
 * redirect revalidation, connect-time address pinning (which is what closes DNS
 * rebinding), the byte cap, and the two deadlines above. This module just says
 * what a calendar feed is allowed to cost.
 */
async function fetchFeedText(icsUrl: string): Promise<string> {
  const result = await fetchPublicText(icsUrl, {
    maxBytes: MAX_ICS_BYTES,
    headersTimeoutMs: FEED_HEADERS_TIMEOUT_MS,
    totalTimeoutMs: FEED_TOTAL_TIMEOUT_MS,
    headers: FEED_REQUEST_HEADERS,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Calendar responded with ${result.status}`);
  }

  return result.text;
}

/** How far `timeZone` sits from UTC at the given instant, in milliseconds. */
function zoneOffsetMs(instantMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(new Date(instantMs))
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Intl renders midnight as hour 24 in some locales/zones.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return wallClock - instantMs;
}

/**
 * Turn an all-day feed date (which parseIcsTimestamp anchored to UTC midnight)
 * into the instant it actually means: the end of that calendar day in `timeZone`.
 *
 * Canvas publishes assignment deadlines as a bare `VALUE=DATE` — no time, no zone
 * — yet shows 11:59pm in its own UI. This reproduces that, so a Pacific student
 * sees "Jun 30, 11:59 PM" rather than the raw midnight-UTC value ("Jun 29, 5:00
 * PM"). A null zone (user never onboarded) leaves it at the UTC end of day.
 *
 * Shared by the auto-sync engine (which stores it as the task's dueAt) and the
 * read-only calendar (which shows the same time for a feed event that isn't
 * synced), so a due date reads identically whether or not it became a task.
 */
export function endOfDayInZone(
  dateAtUtcMidnight: Date,
  timeZone: string | null
) {
  const endOfUtcDay = dateAtUtcMidnight.getTime() + 23 * 3600_000 + 59 * 60_000;
  if (!timeZone) return new Date(endOfUtcDay);

  // Guess, then correct by the offset in force at the guess. A second pass would
  // only matter for a DST jump landing inside 23:59–00:00, which no zone uses.
  const guess = endOfUtcDay;
  return new Date(guess - zoneOffsetMs(guess, timeZone));
}

/** True when a calendar table hasn't been migrated in yet (dev DBs lag deploys). */
function isMissingCalendarSubscriptionTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.message === 'string' &&
    (error.message.includes('CalendarSubscription') ||
      error.message.includes('CalendarIgnoredEvent'))
  );
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseMonthParam(monthParam?: string) {
  if (!monthParam) return startOfMonth(new Date());
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  if (!match) return startOfMonth(new Date());
  const [, year, month] = match;
  return new Date(Number(year), Number(month) - 1, 1);
}

function parseDayParam(dayParam: string | undefined, fallbackMonth: Date) {
  if (!dayParam) return startOfDay(new Date());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayParam);
  if (!match) return startOfDay(fallbackMonth);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function getCalendarGridRange(month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = endOfDay(addDays(monthEnd, 6 - monthEnd.getDay()));
  return { gridStart, gridEnd };
}

function buildDayBuckets(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = toDayKey(event.startsAt);
    acc[key] ??= [];
    acc[key].push(event);
    return acc;
  }, {});
}

function parseIcsTimestamp(
  rawValue: string,
  params: Record<string, string>
): { date: Date | null; allDay: boolean } {
  if (!rawValue) return { date: null, allDay: false };

  const isAllDay = params.VALUE === 'DATE' || /^\d{8}$/.test(rawValue);

  if (isAllDay) {
    const year = Number(rawValue.slice(0, 4));
    const month = Number(rawValue.slice(4, 6)) - 1;
    const day = Number(rawValue.slice(6, 8));
    // Anchor to UTC midnight, not the server's midnight: a VALUE=DATE carries no
    // zone, so the instant must not depend on where the process happens to run.
    // Consumers that know the viewer's zone (calendar-sync) re-anchor from here.
    return { date: new Date(Date.UTC(year, month, day)), allDay: true };
  }

  const utcMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(
    rawValue
  );
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return {
      date: new Date(
        Date.UTC(
          Number(y),
          Number(m) - 1,
          Number(d),
          Number(hh),
          Number(mm),
          Number(ss)
        )
      ),
      allDay: false,
    };
  }

  const localMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(
    rawValue
  );
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    return {
      date: new Date(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(hh),
        Number(mm),
        Number(ss)
      ),
      allDay: false,
    };
  }

  const fallback = new Date(rawValue);
  return {
    date: Number.isNaN(fallback.getTime()) ? null : fallback,
    allDay: false,
  };
}

function unfoldIcsLines(icsText: string) {
  const normalized = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function parseIcsProperty(line: string) {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) return null;

  const descriptor = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [name, ...paramEntries] = descriptor.split(';');
  const params = paramEntries.reduce<Record<string, string>>((acc, entry) => {
    const [paramName, paramValue] = entry.split('=');
    if (paramName && paramValue) {
      acc[paramName.toUpperCase()] = paramValue;
    }
    return acc;
  }, {});

  return {
    name: name.toUpperCase(),
    params,
    value,
  };
}

function parseRRule(rrule: string | null) {
  if (!rrule) return null;
  return rrule.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      acc[key.toUpperCase()] = value;
    }
    return acc;
  }, {});
}

function eventDurationMs(event: ParsedIcsEvent) {
  if (!event.endsAt) {
    return event.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  }

  return Math.max(0, event.endsAt.getTime() - event.startsAt.getTime());
}

function intersectsRange(
  startsAt: Date,
  endsAt: Date | null,
  rangeStart: Date,
  rangeEnd: Date
) {
  const end = endsAt ?? startsAt;
  return end >= rangeStart && startsAt <= rangeEnd;
}

function expandRecurringEvent(
  event: ParsedIcsEvent,
  rangeStart: Date,
  rangeEnd: Date
) {
  const rule = parseRRule(event.rrule);
  if (!rule?.FREQ) return [event];

  // Sanitize the numbers a hostile feed controls. `INTERVAL=abc` would parse to
  // NaN, `addDays(cursor, NaN)` yields an Invalid Date, and every `cursor > …`
  // comparison against it is false — so the stepping loops below would never
  // advance and never terminate. Fall back to a step of 1 / no explicit count.
  const interval = positiveIntOrNull(rule.INTERVAL) ?? 1;
  const countLimit = positiveIntOrNull(rule.COUNT);
  const untilInfo = rule.UNTIL
    ? parseIcsTimestamp(rule.UNTIL, {})
    : { date: null, allDay: false };
  const until = untilInfo.date;
  const durationMs = eventDurationMs(event);
  const occurrences: ParsedIcsEvent[] = [];
  let generated = 0;

  const pushOccurrence = (start: Date) => {
    // Absolute brake, independent of INTERVAL/COUNT/UNTIL: once an event has
    // produced this many candidates it stops, so no crafted rule can loop
    // forever. Bounds `generated`, which every stepping loop breaks on.
    if (generated >= MAX_RECURRENCE_STEPS) {
      return false;
    }
    if (countLimit !== null && generated >= countLimit) {
      return false;
    }
    if (until && start > until) {
      return false;
    }

    generated += 1;
    const nextEvent = {
      ...event,
      startsAt: start,
      endsAt: durationMs > 0 ? new Date(start.getTime() + durationMs) : null,
    };

    if (
      intersectsRange(
        nextEvent.startsAt,
        nextEvent.endsAt,
        rangeStart,
        rangeEnd
      )
    ) {
      occurrences.push(nextEvent);
    }

    return true;
  };

  if (!pushOccurrence(event.startsAt)) {
    return [];
  }

  if (rule.FREQ === 'DAILY') {
    let cursor = event.startsAt;
    while (true) {
      cursor = addDays(cursor, interval);
      if (cursor > rangeEnd && (!until || cursor > until)) break;
      if (!pushOccurrence(cursor)) break;
      if (cursor > rangeEnd && countLimit === null) break;
    }
    return occurrences;
  }

  if (rule.FREQ === 'WEEKLY') {
    const byDays = (rule.BYDAY?.split(',').filter(Boolean) ?? [
      ICAL_DAY_KEYS[event.startsAt.getDay()],
    ]) as string[];
    let weekStart = startOfDay(
      addDays(event.startsAt, -event.startsAt.getDay())
    );

    while (true) {
      for (const byDay of byDays) {
        const dayIndex = ICAL_DAY_KEYS.indexOf(
          byDay as (typeof ICAL_DAY_KEYS)[number]
        );
        if (dayIndex === -1) continue;
        const occurrenceDate = addDays(weekStart, dayIndex);
        occurrenceDate.setHours(
          event.startsAt.getHours(),
          event.startsAt.getMinutes(),
          event.startsAt.getSeconds(),
          event.startsAt.getMilliseconds()
        );
        if (occurrenceDate <= event.startsAt) continue;
        if (occurrenceDate > rangeEnd && (!until || occurrenceDate > until)) {
          return occurrences;
        }
        if (!pushOccurrence(occurrenceDate)) {
          return occurrences;
        }
      }
      weekStart = addDays(weekStart, interval * 7);
    }
  }

  if (rule.FREQ === 'MONTHLY') {
    let cursor = event.startsAt;
    while (true) {
      cursor = addMonths(cursor, interval);
      if (cursor > rangeEnd && (!until || cursor > until)) break;
      if (!pushOccurrence(cursor)) break;
      if (cursor > rangeEnd && countLimit === null) break;
    }
    return occurrences;
  }

  return occurrences;
}

function parseIcsEvents(icsText: string) {
  const lines = unfoldIcsLines(icsText);
  const events: ParsedIcsEvent[] = [];
  let current: Record<
    string,
    { value: string; params: Record<string, string> }
  > | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (!current) continue;
      const startsAtInfo = current.DTSTART
        ? parseIcsTimestamp(current.DTSTART.value, current.DTSTART.params)
        : { date: null, allDay: false };
      const endsAtInfo = current.DTEND
        ? parseIcsTimestamp(current.DTEND.value, current.DTEND.params)
        : { date: null, allDay: startsAtInfo.allDay };

      if (
        startsAtInfo.date &&
        current.SUMMARY?.value &&
        events.length < MAX_FEED_EVENTS
      ) {
        events.push({
          uid:
            current.UID?.value ??
            `${current.SUMMARY.value}-${startsAtInfo.date.toISOString()}`,
          summary: current.SUMMARY.value,
          description: current.DESCRIPTION?.value ?? null,
          startsAt: startsAtInfo.date,
          endsAt: endsAtInfo.date,
          allDay: startsAtInfo.allDay,
          rrule: current.RRULE?.value ?? null,
        });
      }

      current = null;
      continue;
    }

    if (!current) continue;
    const property = parseIcsProperty(line);
    if (!property) continue;
    current[property.name] = { value: property.value, params: property.params };
  }

  return events;
}

/**
 * How long a fetched feed may be reused before we go back to the publisher.
 *
 * This exists to keep one calendar page view down to one upstream request:
 * every day cell is a `<Link>`, so Next prefetches ~40 variants of the page and
 * renders each one on the server. Without reuse that's ~40 hits on Canvas per
 * visit.
 */
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_CACHE_MAX_ENTRIES = 64;

/**
 * The cached value is the in-flight *promise*, not the resolved events, so the
 * prefetch fan-out above collapses into a single upstream request instead of
 * ~40 simultaneous misses.
 */
type FeedCacheEntry = { fetchedAt: number; events: Promise<ParsedIcsEvent[]> };

const feedCache = new Map<string, FeedCacheEntry>();

function readFeedCache(icsUrl: string) {
  const entry = feedCache.get(icsUrl);
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt >= FEED_CACHE_TTL_MS) {
    feedCache.delete(icsUrl);
    return null;
  }

  return entry.events;
}

function writeFeedCache(icsUrl: string, events: Promise<ParsedIcsEvent[]>) {
  // Re-insert so the key moves to the end: Map iterates in insertion order,
  // which makes the eviction below least-recently-fetched.
  feedCache.delete(icsUrl);
  feedCache.set(icsUrl, { fetchedAt: Date.now(), events });

  while (feedCache.size > FEED_CACHE_MAX_ENTRIES) {
    const oldest = feedCache.keys().next().value;
    if (oldest === undefined) break;
    feedCache.delete(oldest);
  }
}

async function fetchIcsEventsUncached(icsUrl: string) {
  // Never cached by the runtime, on purpose. Next's data cache is
  // stale-while-revalidate: an expired entry is handed to the caller *and then*
  // refreshed in the background, so two callers a second apart can legitimately
  // see two different generations of the same feed. That is exactly what broke
  // auto-sync — see the note on `fetchIcsEvents`. Freshness is managed above
  // instead, where both callers share one generation. fetchPublicText goes
  // straight to the socket, so there is no runtime cache in play at all.
  //
  // Note this runs on every stored feed, not just at add time: a URL that was
  // public when the student pasted it is re-validated here on each pull, so a
  // host that later points somewhere internal is refused.
  return parseIcsEvents(await fetchFeedText(icsUrl));
}

/**
 * Fetch + parse a feed into its raw (unexpanded) events. Shared by the calendar
 * renderer and the auto-sync engine.
 *
 * `fresh` skips the reuse window and pulls from the publisher. Auto-sync passes
 * it, and that is load-bearing rather than a nicety: the sync is what writes
 * assignments, so it must never decide "nothing new" from a feed older than the
 * one the page just rendered. When it did, the page showed a newly published
 * deadline as "Imported", the arrival sync read the previous generation, found
 * nothing to create, and still stamped `lastSyncedAt` — so the task only
 * appeared on the second visit, or after the user pressed "Sync now".
 *
 * A fresh pull also refills the shared entry, so the `router.refresh()` that
 * follows a sync renders from the same bytes the sync just wrote from.
 */
export async function fetchIcsEvents(
  icsUrl: string,
  { fresh = false }: { fresh?: boolean } = {}
): Promise<ParsedIcsEvent[]> {
  if (!fresh) {
    const cached = readFeedCache(icsUrl);
    if (cached) return cached;
  }

  const pending = fetchIcsEventsUncached(icsUrl);
  writeFeedCache(icsUrl, pending);

  try {
    return await pending;
  } catch (error) {
    // Never leave a rejected promise in the cache — every caller for the next
    // five minutes would inherit this failure instead of retrying.
    if (feedCache.get(icsUrl)?.events === pending) feedCache.delete(icsUrl);
    throw error;
  }
}

/**
 * How far back/forward from today auto-sync materializes feed events. Lives here
 * rather than in calendar-sync so the calendar page can apply the same bounds
 * without importing the sync engine (which imports this module).
 */
const SYNC_WINDOW_DAYS_PAST = 30;
const SYNC_WINDOW_DAYS_FUTURE = 270;

export type SyncWindow = { start: Date; end: Date };

export function getSyncWindow(now = new Date()): SyncWindow {
  const start = new Date(now);
  start.setDate(start.getDate() - SYNC_WINDOW_DAYS_PAST);
  const end = new Date(now);
  end.setDate(end.getDate() + SYNC_WINDOW_DAYS_FUTURE);
  return { start, end };
}

/**
 * Would auto-sync turn this raw feed event into an assignment?
 *
 * The single source of truth for that question: the sync engine filters with it,
 * and the calendar page counts pending work with it. They have to agree — if the
 * page counted events the engine skips (recurring lectures, ignored UIDs, events
 * outside the window), the count would never reach zero and the "new items
 * pending" force-sync below would fire on every single page load.
 */
export function isSyncableFeedEvent(
  event: ParsedIcsEvent,
  ignoredUids: Set<string>,
  window: SyncWindow
) {
  return (
    !event.rrule &&
    !ignoredUids.has(event.uid) &&
    event.startsAt >= window.start &&
    event.startsAt <= window.end
  );
}

type SubscriptionForFetch = {
  id: string;
  name: string;
  icsUrl: string;
  color: string;
  autoSync: boolean;
  lastSyncedAt: Date | null;
};

// Generic over the row shape so callers keep their extra selected fields
// (`_count`, …) on the returned `subscription`.
async function fetchSubscriptionEvents<T extends SubscriptionForFetch>(
  subscription: T,
  rangeStart: Date,
  rangeEnd: Date,
  ignoredUids: Set<string>,
  timeZone: string | null,
  syncWindow: SyncWindow
) {
  try {
    const parsedEvents = await fetchIcsEvents(subscription.icsUrl);

    // Every UID auto-sync would materialize, measured against the *whole* feed
    // rather than the visible grid: a class published today usually has its
    // deadlines in a month the student isn't looking at yet.
    const syncableUids = parsedEvents
      .filter((event) => isSyncableFeedEvent(event, ignoredUids, syncWindow))
      .map((event) => event.uid);

    const events = parsedEvents
      .flatMap((event) => expandRecurringEvent(event, rangeStart, rangeEnd))
      .filter((event) =>
        intersectsRange(event.startsAt, event.endsAt, rangeStart, rangeEnd)
      )
      .map<CalendarEvent>((event, index) => ({
        id: `imported-${subscription.id}-${event.uid}-${index}`,
        source: 'imported',
        sourceId: subscription.id,
        title: cleanIcsText(event.summary) || event.summary,
        // An all-day feed date means "due at the end of that day". Resolve it to
        // the same 11:59pm-in-your-zone instant auto-sync stores, and render it
        // with a time — so a Canvas deadline reads "11:59 PM" whether or not it's
        // synced, instead of a bare "All day" that also sat a day early.
        startsAt: event.allDay
          ? endOfDayInZone(event.startsAt, timeZone)
          : event.startsAt,
        endsAt: event.allDay ? null : event.endsAt,
        allDay: false,
        status: null,
        color: subscription.color || DEFAULT_IMPORTED_COLOR,
        description: cleanIcsText(event.description) || null,
        href: null,
        meta: subscription.name,
        courseId: null,
        groupId: null,
        uid: event.uid,
        subscriptionId: subscription.id,
        ignored: ignoredUids.has(event.uid),
        autoSynced: false,
      }));

    return {
      events,
      syncableUids,
      subscription: { ...subscription, syncError: null as string | null },
    };
  } catch (error) {
    return {
      events: [] as CalendarEvent[],
      syncableUids: [] as string[],
      subscription: {
        ...subscription,
        syncError:
          error instanceof Error ? error.message : 'Calendar sync failed',
      },
    };
  }
}

/**
 * Confirms a URL actually returns an ICS feed before we save it. Gives fast,
 * Canvas-aware feedback for the common mistakes: pasting the Canvas page URL
 * instead of the "Calendar Feed" link, a typo, or an expired feed token. The
 * feed still re-syncs live on every calendar view — this is just an add-time
 * sanity check, not the sync itself.
 */
export async function verifyIcsFeed(
  icsUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Same client as the recurring pulls. It used to differ here — this check
    // validated the pasted host and then followed redirects, so a public
    // redirector could send the verification request anywhere on the internal
    // network. Sharing one client is what stops the two paths drifting apart.
    const result = await fetchPublicText(icsUrl, {
      maxBytes: MAX_ICS_BYTES,
      headersTimeoutMs: FEED_HEADERS_TIMEOUT_MS,
      totalTimeoutMs: FEED_TOTAL_TIMEOUT_MS,
      headers: FEED_REQUEST_HEADERS,
    });

    if (result.status < 200 || result.status >= 300) {
      return {
        ok: false,
        error: `The calendar link responded with ${result.status}. Double-check the URL and that the feed is still active.`,
      };
    }

    if (!result.text.includes('BEGIN:VCALENDAR')) {
      return {
        ok: false,
        error:
          'That link did not return a calendar feed. In Canvas, open Calendar → "Calendar Feed" and copy the .ics link (not the Canvas page URL).',
      };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof SafeFetchError) {
      switch (error.kind) {
        case 'blocked':
        case 'redirect':
          return {
            ok: false,
            error:
              'That calendar link points to a private or unreachable address. Paste a public https:// feed URL (in Canvas: Calendar → "Calendar Feed").',
          };
        case 'timeout':
          return {
            ok: false,
            error:
              'The calendar link took too long to respond. Try again in a moment.',
          };
        case 'too-large':
          return {
            ok: false,
            error:
              'That calendar feed is too large to import. Try a feed limited to a single term.',
          };
      }
    }
    return {
      ok: false,
      error: 'Could not reach that calendar link. Check the URL and try again.',
    };
  }
}

async function loadCalendarSubscriptions(userId: string) {
  try {
    return await prisma.calendarSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        icsUrl: true,
        color: true,
        autoSync: true,
        lastSyncedAt: true,
        _count: { select: { syncedAssignments: true, ignoredEvents: true } },
      },
    });
  } catch (error) {
    if (isMissingCalendarSubscriptionTable(error)) {
      return [];
    }
    throw error;
  }
}

/** Ignored feed UIDs keyed by subscription id. */
async function loadIgnoredEventUids(userId: string) {
  let rows: Array<{ subscriptionId: string; uid: string }> = [];
  try {
    rows = await prisma.calendarIgnoredEvent.findMany({
      where: { subscription: { userId } },
      select: { subscriptionId: true, uid: true },
    });
  } catch (error) {
    if (isMissingCalendarSubscriptionTable(error)) {
      return new Map<string, Set<string>>();
    }
    throw error;
  }

  return rows.reduce((acc, row) => {
    const uids = acc.get(row.subscriptionId) ?? new Set<string>();
    uids.add(row.uid);
    acc.set(row.subscriptionId, uids);
    return acc;
  }, new Map<string, Set<string>>());
}

async function loadAssignedGroupTasks(
  userId: string,
  gridStart: Date,
  gridEnd: Date
) {
  const groupTaskAssignee = (
    prisma as typeof prisma & {
      groupTaskAssignee?: {
        findMany: typeof prisma.groupTaskAssignee.findMany;
      };
    }
  ).groupTaskAssignee;

  if (!groupTaskAssignee) {
    return [];
  }

  try {
    return await groupTaskAssignee.findMany({
      where: {
        userId,
        task: {
          dueAt: { gte: gridStart, lte: gridEnd },
        },
      },
      select: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            dueAt: true,
            status: true,
            groupId: true,
            group: { select: { name: true } },
          },
        },
      },
      orderBy: [{ task: { dueAt: 'asc' } }],
    });
  } catch (error) {
    if (isMissingGroupTables(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * Every dated group task the user can see — i.e. from any group they belong to —
 * regardless of whether it's assigned to them. Backs the "Show all group tasks"
 * calendar toggle. The row shape is normalized to `{ task }` so it drops into the
 * same mapping `loadAssignedGroupTasks` feeds, and de-duplication (a user is
 * always a member of their own groups) is a non-issue because we query tasks, not
 * assignments — each task appears once.
 */
async function loadAllGroupTasks(
  userId: string,
  gridStart: Date,
  gridEnd: Date
) {
  try {
    const tasks = await prisma.groupTask.findMany({
      where: {
        group: { memberships: { some: { userId } } },
        dueAt: { gte: gridStart, lte: gridEnd },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
        groupId: true,
        group: { select: { name: true } },
      },
      orderBy: [{ dueAt: 'asc' }],
    });

    return tasks.map((task) => ({ task }));
  } catch (error) {
    if (isMissingGroupTables(error)) {
      return [];
    }
    throw error;
  }
}

/** Personal events overlapping the grid: starts before it ends, and (if it has an end) ends after it starts. */
async function loadPersonalEvents(
  userId: string,
  gridStart: Date,
  gridEnd: Date
) {
  return prisma.personalEvent.findMany({
    where: {
      userId,
      startsAt: { lte: gridEnd },
      OR: [{ endsAt: null }, { endsAt: { gte: gridStart } }],
    },
    orderBy: [{ startsAt: 'asc' }],
  });
}

export async function getCalendarPageData(
  userId: string,
  monthParam?: string,
  dayParam?: string
): Promise<CalendarPageData> {
  const month = parseMonthParam(monthParam);
  const selectedDate = parseDayParam(dayParam, month);
  const { gridStart, gridEnd } = getCalendarGridRange(month);

  // Read the preference first: it decides whether the group-task query below is
  // "assigned to me" or "everything in my groups". One extra round-trip, but it
  // keeps the heavier task query from over-fetching when the toggle is off.
  const preferences = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      timezone: true,
      showAllGroupTasksOnCalendar: true,
      calendarFeedTokenHash: true,
    },
  });
  const showAllGroupTasks = preferences?.showAllGroupTasksOnCalendar ?? false;

  const [
    assignments,
    quests,
    groupTasks,
    subscriptions,
    ignoredUids,
    personalEvents,
    syncedFeedRows,
  ] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        course: { userId },
        dueAt: { gte: gridStart, lte: gridEnd },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
        courseId: true,
        calendarSubscriptionId: true,
        externalUid: true,
        course: { select: { name: true, color: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.quest.findMany({
      where: {
        userId,
        dueAt: { gte: gridStart, lte: gridEnd },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
        estimatedMinutes: true,
        xpReward: true,
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    }),
    showAllGroupTasks
      ? loadAllGroupTasks(userId, gridStart, gridEnd)
      : loadAssignedGroupTasks(userId, gridStart, gridEnd),
    loadCalendarSubscriptions(userId),
    loadIgnoredEventUids(userId),
    loadPersonalEvents(userId, gridStart, gridEnd),
    // Feed-backed assignments across *all* dates, not just the visible grid —
    // this answers "has auto-sync already claimed this feed event?", and a
    // deadline in next month is still claimed.
    prisma.assignment.findMany({
      where: {
        course: { userId },
        calendarSubscriptionId: { not: null },
        externalUid: { not: null },
      },
      select: { calendarSubscriptionId: true, externalUid: true },
    }),
  ]);

  // Feeds carry no timezone, so an all-day due date only means something relative
  // to the student. Theirs anchors the 11:59pm the imported events render at.
  const timeZone = preferences?.timezone ?? null;

  const subscriptionNames = new Map(
    subscriptions.map((subscription) => [subscription.id, subscription.name])
  );

  // Feed events already materialized as assignments are dropped from the
  // imported list below — the assignment row is the richer copy (it carries a
  // status and an edit link), so showing both would double-book the day.
  const syncedFeedKeys = new Set(
    syncedFeedRows.map(
      (row) => `${row.calendarSubscriptionId}::${row.externalUid}`
    )
  );

  const localEvents: CalendarEvent[] = [
    ...assignments.flatMap((assignment) =>
      assignment.dueAt
        ? [
            {
              id: `assignment-${assignment.id}`,
              source: 'assignment' as const,
              sourceId: assignment.id,
              title: assignment.title,
              startsAt: assignment.dueAt,
              endsAt: null,
              allDay: false,
              status: assignment.status,
              color: assignment.course.color,
              description: assignment.description,
              href: `/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}`,
              meta: assignment.calendarSubscriptionId
                ? `${assignment.course.name} · ${
                    subscriptionNames.get(assignment.calendarSubscriptionId) ??
                    'Imported'
                  }`
                : assignment.course.name,
              courseId: assignment.courseId,
              groupId: null,
              uid: assignment.externalUid,
              subscriptionId: assignment.calendarSubscriptionId,
              ignored: false,
              autoSynced: Boolean(assignment.calendarSubscriptionId),
            },
          ]
        : []
    ),
    ...quests.flatMap((quest) =>
      quest.dueAt
        ? [
            {
              id: `quest-${quest.id}`,
              source: 'quest' as const,
              sourceId: quest.id,
              title: quest.title,
              startsAt: quest.dueAt,
              endsAt:
                quest.estimatedMinutes && quest.estimatedMinutes > 0
                  ? new Date(
                      quest.dueAt.getTime() + quest.estimatedMinutes * 60 * 1000
                    )
                  : null,
              allDay: false,
              status: quest.status,
              color: '#8b5cf6',
              description: quest.description,
              href: `/dashboard/quests/${quest.id}/edit`,
              meta: `Quest · ${quest.xpReward} XP`,
              courseId: null,
              groupId: null,
              uid: null,
              subscriptionId: null,
              ignored: false,
              autoSynced: false,
            },
          ]
        : []
    ),
    ...groupTasks.flatMap((assignment) =>
      assignment.task.dueAt
        ? [
            {
              id: `group-task-${assignment.task.id}`,
              source: 'group_task' as const,
              sourceId: assignment.task.id,
              title: assignment.task.title,
              startsAt: assignment.task.dueAt,
              endsAt: null,
              allDay: false,
              status: assignment.task.status,
              color: '#0f766e',
              description: assignment.task.description,
              href: `/dashboard/groups/${assignment.task.groupId}?tab=tasks`,
              meta: `Group · ${assignment.task.group.name}`,
              courseId: null,
              groupId: assignment.task.groupId,
              uid: null,
              subscriptionId: null,
              ignored: false,
              autoSynced: false,
            },
          ]
        : []
    ),
    ...personalEvents.map<CalendarEvent>((event) => ({
      id: `personal-${event.id}`,
      source: 'personal' as const,
      sourceId: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      status: null,
      color: event.color,
      description: event.description,
      href: null,
      meta: null,
      courseId: null,
      groupId: null,
      uid: null,
      subscriptionId: null,
      ignored: false,
      autoSynced: false,
    })),
  ];

  const syncWindow = getSyncWindow();

  const importedResults = await Promise.all(
    subscriptions.map((subscription) =>
      fetchSubscriptionEvents(
        subscription,
        gridStart,
        gridEnd,
        ignoredUids.get(subscription.id) ?? new Set(),
        timeZone,
        syncWindow
      )
    )
  );

  // Feed events an auto-sync feed is carrying that have no assignment behind
  // them yet — a course the instructor published since the last sync ran. The
  // client forces a sync when this is non-zero instead of waiting out the
  // 10-minute throttle, which is what used to leave new classes stuck showing
  // as "Imported" until the user toggled auto-sync off and on by hand.
  const pendingSyncCount = importedResults.reduce((total, result) => {
    if (!result.subscription.autoSync) return total;
    return (
      total +
      result.syncableUids.filter(
        (uid) => !syncedFeedKeys.has(`${result.subscription.id}::${uid}`)
      ).length
    );
  }, 0);

  const importedEvents = importedResults
    .flatMap((result) => result.events)
    .filter(
      (event) => !syncedFeedKeys.has(`${event.subscriptionId}::${event.uid}`)
    );

  const syncedSubscriptions =
    importedResults.map<CalendarSubscriptionWithError>(({ subscription }) => ({
      id: subscription.id,
      name: subscription.name,
      icsUrl: subscription.icsUrl,
      color: subscription.color,
      autoSync: subscription.autoSync,
      lastSyncedAt: subscription.lastSyncedAt,
      syncError: subscription.syncError,
      syncedCount: subscription._count.syncedAssignments,
      ignoredCount: subscription._count.ignoredEvents,
    }));

  const events = [...localEvents, ...importedEvents].sort((a, b) => {
    const timeDiff = a.startsAt.getTime() - b.startsAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.title.localeCompare(b.title);
  });

  const eventsByDay = buildDayBuckets(events);
  const selectedDayEvents = eventsByDay[toDayKey(selectedDate)] ?? [];

  return {
    month,
    selectedDate,
    gridStart,
    gridEnd,
    events,
    eventsByDay,
    selectedDayEvents,
    subscriptions: syncedSubscriptions,
    pendingSyncCount,
    showAllGroupTasks,
    hasCalendarFeedToken: Boolean(preferences?.calendarFeedTokenHash),
  };
}

export async function getDashboardCalendarTasks(
  userId: string,
  limit = 6
): Promise<CalendarTask[]> {
  const now = new Date();
  const nextTwoWeeks = addDays(now, 14);

  const [assignments, quests, groupTasks] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        course: { userId },
        status: { not: 'done' },
        dueAt: { gte: now, lte: nextTwoWeeks },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        courseId: true,
        course: { select: { name: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    }),
    prisma.quest.findMany({
      where: {
        userId,
        status: { not: 'done' },
        dueAt: { gte: now, lte: nextTwoWeeks },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        xpReward: true,
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    }),
    loadAssignedGroupTasks(userId, now, nextTwoWeeks),
  ]);

  return [
    ...assignments.flatMap((assignment) =>
      assignment.dueAt
        ? [
            {
              id: `assignment-${assignment.id}`,
              source: 'assignment' as const,
              sourceId: assignment.id,
              title: assignment.title,
              dueAt: assignment.dueAt,
              status: assignment.status,
              href: `/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}`,
              courseId: assignment.courseId,
              meta: assignment.course.name,
            },
          ]
        : []
    ),
    ...quests.flatMap((quest) =>
      quest.dueAt
        ? [
            {
              id: `quest-${quest.id}`,
              source: 'quest' as const,
              sourceId: quest.id,
              title: quest.title,
              dueAt: quest.dueAt,
              status: quest.status,
              href: `/dashboard/quests/${quest.id}/edit`,
              meta: `${quest.xpReward} XP`,
            },
          ]
        : []
    ),
    ...groupTasks.flatMap((assignment) =>
      assignment.task.dueAt
        ? [
            {
              id: `group-task-${assignment.task.id}`,
              source: 'group_task' as const,
              sourceId: assignment.task.id,
              title: assignment.task.title,
              dueAt: assignment.task.dueAt,
              status: assignment.task.status,
              href: `/dashboard/groups/${assignment.task.groupId}?tab=tasks`,
              groupId: assignment.task.groupId,
              meta: assignment.task.group.name,
            },
          ]
        : []
    ),
  ]
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, limit);
}

export function formatCalendarTime(date: Date, allDay = false) {
  if (allDay) return 'All day';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getMonthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getDayParam(date: Date) {
  return toDayKey(date);
}
