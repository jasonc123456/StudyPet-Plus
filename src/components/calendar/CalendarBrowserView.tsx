'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { EventDescription } from '@/components/calendar/EventDescription';
import { EventStatusIcon } from '@/components/calendar/EventStatusIcon';
import { useTimezone } from '@/components/TimezoneProvider';

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

function formatEventRange(event: ParsedEvent, timeZone?: string) {
  if (event.allDay) return 'All day';

  const start = formatEventTime(event.startsAtDate, false, timeZone);
  if (!event.endsAtDate) return start;

  return `${start} – ${formatEventTime(event.endsAtDate, false, timeZone)}`;
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
      const key = toDayKey(event.startsAtDate);
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

        <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
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
                  'min-h-28 rounded-2xl border p-3 text-left transition',
                  isSelected
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-brand-200',
                  !isCurrentMonth ? 'opacity-55' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={[
                      'text-sm font-semibold',
                      isToday
                        ? 'rounded-full bg-brand-600 px-2 py-0.5 text-white'
                        : 'text-slate-700',
                    ].join(' ')}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[11px] font-medium text-slate-400">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
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
                          className="h-3 w-3"
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

                {canIgnore(event) && (
                  <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
