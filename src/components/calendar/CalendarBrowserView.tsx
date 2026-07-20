'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CalendarEventStatusControl } from '@/components/calendar/CalendarEventStatusControl';
import type { StatusTarget } from '@/components/calendar/CalendarEventStatusControl';
import { CalendarStatusButtons } from '@/components/calendar/CalendarStatusButtons';
import { EventDescription } from '@/components/calendar/EventDescription';
import { EventStatusIcon } from '@/components/calendar/EventStatusIcon';
import { useTimezone } from '@/components/TimezoneProvider';

// Group tasks store status as an uppercase enum; the shared control matches
// values case-insensitively, so these light up the same to-do/in-progress/done
// pill the assignment control uses.
const GROUP_TASK_STATUS_OPTIONS = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
] as const;

type CalendarBrowserEvent = {
  id: string;
  source: 'assignment' | 'quest' | 'group_task' | 'imported';
  sourceId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  status: string | null;
  color: string;
  description: string | null;
  href: string | null;
  meta: string | null;
  courseId: string | null;
  groupId: string | null;
  uid: string | null;
  subscriptionId: string | null;
  ignored: boolean;
  autoSynced: boolean;
};

type ParsedEvent = CalendarBrowserEvent & {
  startsAtDate: Date;
  endsAtDate: Date | null;
};

type CalendarBrowserViewProps = {
  initialMonth: string;
  initialSelectedDate: string;
  initialGridStart: string;
  initialGridEnd: string;
  initialEvents: CalendarBrowserEvent[];
  /** Subscriptions with auto-sync on — these get the "not an assignment" control. */
  autoSyncSubscriptionIds: string[];
  /**
   * Persisted preference: when true the feed already includes every group task
   * from the user's groups; when false only the ones assigned to them. Drives
   * the toggle below, which round-trips through the API and re-fetches.
   */
  initialShowAllGroupTasks: boolean;
};

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1, 12);
}

/**
 * The server picks the grid's first Sunday and last Saturday in UTC and sends
 * them as instants. Reading those instants back with local getters would drag
 * every cell into the previous day for any viewer west of UTC — Jun 28 00:00Z is
 * still Jun 27 in Los Angeles — which slides the whole month one column right
 * and files Fridays under Saturday. So take the calendar date out of the ISO
 * string and rebuild it at local noon, far from either DST edge.
 */
function localDateFromUtcParts(iso: string) {
  const instant = new Date(iso);
  return new Date(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
    12
  );
}

function buildGridDays(startIso: string, endIso: string) {
  const end = localDateFromUtcParts(endIso);
  const days: Date[] = [];

  for (const cursor = localDateFromUtcParts(startIso); cursor <= end;) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatMonthTitle(monthKey: string) {
  return parseMonthKey(monthKey).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatDayHeading(dayKey: string) {
  return parseDayKey(dayKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// `timeZone` is passed explicitly so the first render is deterministic: the
// server runs in UTC, so we format in UTC for SSR + the initial client paint
// (avoiding a hydration mismatch), then swap to the user's zone after mount.
function formatEventTime(date: Date, allDay: boolean, timeZone?: string) {
  if (allDay) return 'All day';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

// Mirrors `formatEventTime`'s UTC-first strategy: bucketing an event's UTC
// instant into a calendar day with local getters depends on the runtime's
// zone, so the server (UTC) and a client west of UTC would sort the same
// event into different days and render a different number of event nodes —
// a structural hydration mismatch, not just a text one. Deriving the day key
// from the same `timeZone` used for display keeps grouping and label in sync
// on both the SSR pass and the first client paint.
function toDayKeyInZone(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatEventRange(event: ParsedEvent, timeZone?: string) {
  if (event.allDay) return 'All day';

  const start = formatEventTime(event.startsAtDate, false, timeZone);
  if (!event.endsAtDate) return start;

  return `${start} – ${formatEventTime(event.endsAtDate, false, timeZone)}`;
}

/**
 * Bucket a day's events by task status for the compact mobile summary. Anything
 * without a to-do/in-progress/done status (quests, plain imported events) falls
 * into `other` so nothing silently vanishes from the count.
 */
function statusCounts(events: ParsedEvent[]) {
  const counts = { todo: 0, in_progress: 0, done: 0, other: 0 };
  for (const event of events) {
    const key = event.status?.toLowerCase();
    if (key === 'todo' || key === 'in_progress' || key === 'done') {
      counts[key] += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

/**
 * Mobile-only per-day summary: one small glyph + number per status present, so a
 * cramped phone cell shows how many things are to-do / in-progress / done
 * instead of unreadable truncated event text. Tapping the day opens the full
 * list in the agenda below.
 */
function DayStatusChips({ events }: { events: ParsedEvent[] }) {
  const counts = statusCounts(events);
  const buckets = (['todo', 'in_progress', 'done'] as const).filter(
    (key) => counts[key] > 0
  );

  return (
    <>
      {buckets.map((key) => (
        <span key={key} className="inline-flex items-center gap-0.5">
          <EventStatusIcon status={key} className="h-3 w-3" />
          <span className="text-[10px] font-semibold tabular-nums text-slate-600">
            {counts[key]}
          </span>
        </span>
      ))}
      {counts.other > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden />
          <span className="text-[10px] font-semibold tabular-nums text-slate-600">
            {counts.other}
          </span>
        </span>
      )}
    </>
  );
}

/** The subtle uppercase pill on the right of an agenda card. */
function SourceBadge({ event }: { event: ParsedEvent }) {
  if (event.ignored) {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Ignored
      </span>
    );
  }

  if (event.autoSynced) {
    return (
      <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
        Synced
      </span>
    );
  }

  if (event.source === 'imported') {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Imported
      </span>
    );
  }

  return null;
}

export function CalendarBrowserView({
  initialMonth,
  initialSelectedDate,
  initialGridStart,
  initialGridEnd,
  initialEvents,
  autoSyncSubscriptionIds,
  initialShowAllGroupTasks,
}: CalendarBrowserViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userTimeZone = useTimezone();
  const [clientTodayKey, setClientTodayKey] = useState(initialSelectedDate);
  // Before mount we format in UTC to match the server; after mount we switch to
  // the user's stored zone (or their browser's when none is set).
  const [mounted, setMounted] = useState(false);
  const displayZone = mounted ? userTimeZone : 'UTC';

  const [syncing, setSyncing] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The toggle is optimistic: flip the label immediately, persist the choice,
  // then refresh so the server re-runs getCalendarPageData with the new scope.
  const [showAllGroupTasks, setShowAllGroupTasks] = useState(
    initialShowAllGroupTasks
  );
  const [groupTasksPending, setGroupTasksPending] = useState(false);
  const [pendingStatusEventId, setPendingStatusEventId] = useState<
    string | null
  >(null);
  // One auto-sync attempt per mount; router.refresh() below must not retrigger it.
  const autoSyncAttempted = useRef(false);

  const autoSyncIds = new Set(autoSyncSubscriptionIds);
  const hasAutoSync = autoSyncSubscriptionIds.length > 0;

  const queryString = searchParams.toString();
  const monthKey = searchParams.get('month') || initialMonth;
  const selectedDayKey =
    searchParams.get('day') ||
    clientTodayKey ||
    initialSelectedDate ||
    toDayKey(new Date());
  const monthDate = parseMonthKey(monthKey);
  const prevMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() - 1,
    1,
    12
  );
  const nextMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    1,
    12
  );
  const monthDays = buildGridDays(initialGridStart, initialGridEnd);
  const todayKey = clientTodayKey || toDayKey(new Date());
  const parsedEvents: ParsedEvent[] = initialEvents
    .map((event) => ({
      ...event,
      startsAtDate: new Date(event.startsAt),
      endsAtDate: event.endsAt ? new Date(event.endsAt) : null,
    }))
    .sort((left, right) => {
      const timeDiff =
        left.startsAtDate.getTime() - right.startsAtDate.getTime();
      if (timeDiff !== 0) return timeDiff;
      return left.title.localeCompare(right.title);
    });

  const eventsByDay = parsedEvents.reduce<Record<string, ParsedEvent[]>>(
    (acc, event) => {
      const key = toDayKeyInZone(event.startsAtDate, displayZone);
      acc[key] ??= [];
      acc[key].push(event);
      return acc;
    },
    {}
  );
  const selectedDayEvents = eventsByDay[selectedDayKey] ?? [];

  function buildCalendarHref(nextMonthKey: string, nextDayKey: string) {
    const params = new URLSearchParams(queryString);
    params.set('month', nextMonthKey);
    params.set('day', nextDayKey);
    return `${pathname}?${params.toString()}`;
  }

  /**
   * Where a status change for this event is written, or null when there's no
   * task row behind it — a feed event the user hasn't synced. The control still
   * renders in that case, dimmed, to point at what would unlock it.
   */
  function statusTarget(event: ParsedEvent): StatusTarget | null {
    if (event.source !== 'assignment' || !event.courseId) return null;
    return { courseId: event.courseId, assignmentId: event.sourceId };
  }

  /** Assignments/feed events get the assignment status control; quests don't. */
  function hasStatusControl(event: ParsedEvent) {
    return event.source === 'assignment' || event.source === 'imported';
  }

  /** Group tasks get their own status control, writing to the group-task API. */
  function hasGroupStatusControl(event: ParsedEvent) {
    return event.source === 'group_task' && Boolean(event.groupId);
  }

  /** An event can be ignored when it came from a feed the user auto-syncs. */
  function canIgnore(event: ParsedEvent) {
    if (!event.subscriptionId || !event.uid) return false;
    return event.ignored || autoSyncIds.has(event.subscriptionId);
  }

  async function toggleIgnore(event: ParsedEvent) {
    setPendingEventId(event.id);
    setActionError(null);

    try {
      const response = await fetch('/api/calendar/ignores', {
        method: event.ignored ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: event.subscriptionId,
          uid: event.uid,
          title: event.title,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setActionError(data?.error ?? 'Unable to update this event');
        return;
      }

      router.refresh();
    } catch {
      setActionError('Network error — please try again');
    } finally {
      setPendingEventId(null);
    }
  }

  async function toggleShowAllGroupTasks() {
    const next = !showAllGroupTasks;
    setShowAllGroupTasks(next);
    setGroupTasksPending(true);
    setActionError(null);

    try {
      const response = await fetch('/api/me/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showAllGroupTasks: next }),
      });

      if (!response.ok) {
        setShowAllGroupTasks(!next);
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setActionError(data?.error ?? 'Unable to update this preference');
        return;
      }

      router.refresh();
    } catch {
      setShowAllGroupTasks(!next);
      setActionError('Network error — please try again');
    } finally {
      setGroupTasksPending(false);
    }
  }

  /**
   * Write a group task's status straight from its agenda card, mirroring the
   * assignment control but posting to the group-task API. The control shows for
   * every group task; the API is the gate — it rejects a member who isn't the
   * task's assignee, creator, or a group admin, and that error surfaces here.
   */
  async function updateGroupTaskStatus(event: ParsedEvent, nextStatus: string) {
    if (!event.groupId || nextStatus === event.status) return;

    setPendingStatusEventId(event.id);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/groups/${event.groupId}/tasks/${event.sourceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setActionError(data?.error ?? 'Failed to update status');
        return;
      }

      router.refresh();
    } catch {
      setActionError('Network error — please try again');
    } finally {
      setPendingStatusEventId(null);
    }
  }

  useEffect(() => {
    setMounted(true);

    const now = new Date();
    const localMonth = getMonthKey(now);
    const localDay = toDayKey(now);

    setClientTodayKey(localDay);

    if (searchParams.get('month') && searchParams.get('day')) {
      return;
    }

    const params = new URLSearchParams(queryString);
    params.set('month', params.get('month') || localMonth);
    params.set('day', params.get('day') || localDay);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, queryString, router, searchParams]);

  // Auto-sync on arrival. The API throttles each feed to one upstream pull per
  // 10 minutes, and we only refresh when rows actually changed — otherwise this
  // would loop against its own router.refresh().
  useEffect(() => {
    if (!hasAutoSync || autoSyncAttempted.current) return;
    autoSyncAttempted.current = true;

    let cancelled = false;
    setSyncing(true);

    fetch('/api/calendar/sync', { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { changed?: number } | null) => {
        if (!cancelled && result && (result.changed ?? 0) > 0) {
          router.refresh();
        }
      })
      .catch(() => {
        /* A failed background sync is silent — the feed still renders. */
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasAutoSync, router]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,1fr)]">
      <section className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {formatMonthTitle(monthKey)}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {syncing
                ? 'Syncing your connected calendars…'
                : 'Planner items appear automatically with their due time in your timezone.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={buildCalendarHref(
                getMonthKey(prevMonth),
                toDayKey(prevMonth)
              )}
              className="btn-secondary text-sm"
            >
              Previous
            </Link>
            <Link
              href={buildCalendarHref(
                getMonthKey(new Date()),
                toDayKey(new Date())
              )}
              className="btn-secondary text-sm"
            >
              Today
            </Link>
            <Link
              href={buildCalendarHref(
                getMonthKey(nextMonth),
                toDayKey(nextMonth)
              )}
              className="btn-secondary text-sm"
            >
              Next
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">
              Show all group tasks
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {showAllGroupTasks
                ? 'Showing every dated task from the groups you belong to.'
                : 'Showing only group tasks assigned to you.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showAllGroupTasks}
            aria-label="Show all group tasks on the calendar"
            onClick={toggleShowAllGroupTasks}
            disabled={groupTasksPending}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-wait disabled:opacity-60',
              showAllGroupTasks ? 'bg-brand-600' : 'bg-slate-300',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                showAllGroupTasks ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:gap-2 sm:text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="py-1 sm:py-2">
              <span className="sm:hidden">{label.slice(0, 1)}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        {/* On phones each cell shows per-status counts instead of event text;
            this legend explains the glyphs. Hidden once the full agenda-style
            cells return at sm. */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500 sm:hidden">
          <span className="inline-flex items-center gap-1">
            <EventStatusIcon status="todo" className="h-3 w-3" />
            To do
          </span>
          <span className="inline-flex items-center gap-1">
            <EventStatusIcon status="in_progress" className="h-3 w-3" />
            In progress
          </span>
          <span className="inline-flex items-center gap-1">
            <EventStatusIcon status="done" className="h-3 w-3" />
            Done
          </span>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 sm:mt-0 sm:gap-2">
          {monthDays.map((day) => {
            const dayKey = toDayKey(day);
            const dayEvents = eventsByDay[dayKey] ?? [];
            const isSelected = dayKey === selectedDayKey;
            const isCurrentMonth = day.getMonth() === monthDate.getMonth();
            const isToday = dayKey === todayKey;

            return (
              <Link
                key={dayKey}
                href={buildCalendarHref(monthKey, dayKey)}
                className={[
                  'min-h-16 rounded-xl border p-1 text-left transition sm:min-h-28 sm:rounded-2xl sm:p-3',
                  isSelected
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-brand-200',
                  !isCurrentMonth ? 'opacity-55' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  <span
                    className={[
                      'text-xs font-semibold sm:text-sm',
                      isToday
                        ? 'rounded-full bg-brand-600 px-1.5 py-0.5 text-white sm:px-2'
                        : 'text-slate-700',
                    ].join(' ')}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-medium text-slate-400 sm:text-[11px]">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Mobile: compact per-status counts. Tap the day to open the
                    full list in the agenda below. */}
                {dayEvents.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 sm:hidden">
                    <DayStatusChips events={dayEvents} />
                  </div>
                )}

                {/* Desktop: the roomier inline event list. */}
                <div className="mt-3 hidden space-y-1.5 sm:block">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={[
                        'flex items-center gap-1.5 rounded-lg py-1 pl-2 pr-1.5 text-[11px] font-medium',
                        event.ignored
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700',
                      ].join(' ')}
                      style={{
                        borderLeft: `3px solid ${event.color}`,
                        backgroundColor: `${event.color}18`,
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="tabular-nums text-slate-500">
                          {formatEventTime(
                            event.startsAtDate,
                            event.allDay,
                            displayZone
                          )}
                        </span>{' '}
                        {event.title}
                      </span>
                      {event.status && !event.ignored && (
                        <EventStatusIcon
                          status={event.status}
                          className="h-3 w-3 shrink-0"
                        />
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[11px] text-slate-400">
                      +{dayEvents.length - 3} more
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-semibold text-slate-900">
          {formatDayHeading(selectedDayKey)}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Day agenda from your planner plus imported calendars.
        </p>

        {actionError && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {selectedDayEvents.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Nothing scheduled for this day yet.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {selectedDayEvents.map((event) => (
              <article
                key={event.id}
                className={[
                  'relative overflow-hidden rounded-2xl border border-slate-200 bg-white pl-5 pr-4 py-4 transition hover:border-slate-300',
                  event.ignored ? 'opacity-70' : '',
                ].join(' ')}
              >
                {/* Colour rail: the course / feed colour, full card height. */}
                <span
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ backgroundColor: event.color }}
                  aria-hidden
                />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {event.status ? (
                      <EventStatusIcon
                        status={event.status}
                        className="mt-0.5"
                      />
                    ) : (
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: event.color }}
                        aria-hidden
                      />
                    )}

                    <div className="min-w-0">
                      {event.href ? (
                        <Link
                          href={event.href}
                          className={[
                            'font-semibold text-slate-900 hover:text-brand-600',
                            event.ignored ? 'line-through' : '',
                          ].join(' ')}
                        >
                          {event.title}
                        </Link>
                      ) : (
                        <p
                          className={[
                            'font-semibold text-slate-900',
                            event.ignored ? 'line-through' : '',
                          ].join(' ')}
                        >
                          {event.title}
                        </p>
                      )}

                      <p className="mt-1 text-sm text-slate-500">
                        <span className="tabular-nums">
                          {formatEventRange(event, displayZone)}
                        </span>
                        {event.meta ? ` · ${event.meta}` : ''}
                      </p>
                    </div>
                  </div>

                  <SourceBadge event={event} />
                </div>

                {event.description && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <EventDescription
                      text={event.description}
                      className="text-sm leading-relaxed text-slate-600"
                    />
                  </div>
                )}

                {(hasStatusControl(event) ||
                  hasGroupStatusControl(event) ||
                  canIgnore(event)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                    {hasStatusControl(event) && (
                      <CalendarEventStatusControl
                        title={event.title}
                        status={event.status}
                        target={statusTarget(event)}
                      />
                    )}

                    {hasGroupStatusControl(event) && (
                      <CalendarStatusButtons
                        options={GROUP_TASK_STATUS_OPTIONS}
                        value={event.status ?? 'TODO'}
                        onSelect={(next) => updateGroupTaskStatus(event, next)}
                        ariaLabel={`Change status for ${event.title}`}
                        saving={pendingStatusEventId === event.id}
                      />
                    )}

                    {canIgnore(event) && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleIgnore(event)}
                          disabled={pendingEventId === event.id}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60"
                        >
                          {pendingEventId === event.id
                            ? 'Saving…'
                            : event.ignored
                              ? 'Track as assignment'
                              : 'Not an assignment'}
                        </button>
                        <span className="text-xs text-slate-400">
                          {event.ignored
                            ? 'Skipped by auto-sync'
                            : 'Hide from your assignments'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
