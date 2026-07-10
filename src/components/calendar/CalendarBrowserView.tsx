'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
};

type CalendarBrowserViewProps = {
  initialMonth: string;
  initialSelectedDate: string;
  initialGridStart: string;
  initialGridEnd: string;
  initialEvents: CalendarBrowserEvent[];
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

function buildGridDays(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const days: Date[] = [];

  for (const cursor = new Date(start); cursor <= end;) {
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

export function CalendarBrowserView({
  initialMonth,
  initialSelectedDate,
  initialGridStart,
  initialGridEnd,
  initialEvents,
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
  const parsedEvents = initialEvents
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

  const eventsByDay = parsedEvents.reduce<
    Record<
      string,
      Array<
        CalendarBrowserEvent & {
          startsAtDate: Date;
          endsAtDate: Date | null;
        }
      >
    >
  >((acc, event) => {
    const key = toDayKey(event.startsAtDate);
    acc[key] ??= [];
    acc[key].push(event);
    return acc;
  }, {});
  const selectedDayEvents = eventsByDay[selectedDayKey] ?? [];

  function buildCalendarHref(nextMonthKey: string, nextDayKey: string) {
    const params = new URLSearchParams(queryString);
    params.set('month', nextMonthKey);
    params.set('day', nextDayKey);
    return `${pathname}?${params.toString()}`;
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
      <section className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {formatMonthTitle(monthKey)}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Planner items appear automatically with their due time in your
              timezone.
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
                      className="truncate rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700"
                      style={{
                        borderLeft: `3px solid ${event.color}`,
                        backgroundColor: `${event.color}18`,
                      }}
                    >
                      {formatEventTime(
                        event.startsAtDate,
                        event.allDay,
                        displayZone
                      )}{' '}
                      · {event.title}
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

        {selectedDayEvents.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Nothing scheduled for this day yet.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {selectedDayEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: event.color }}
                        aria-hidden
                      />
                      <p className="truncate font-medium text-slate-900">
                        {event.title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {event.allDay
                        ? 'All day'
                        : `${formatEventTime(
                            event.startsAtDate,
                            false,
                            displayZone
                          )}${
                            event.endsAtDate
                              ? ` - ${formatEventTime(
                                  event.endsAtDate,
                                  false,
                                  displayZone
                                )}`
                              : ''
                          }`}
                      {event.meta ? ` · ${event.meta}` : ''}
                    </p>
                  </div>
                  {event.href ? (
                    <Link
                      href={event.href}
                      className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                      Imported
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="mt-3 text-sm text-slate-600">
                    {event.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
