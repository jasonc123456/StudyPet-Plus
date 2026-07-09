import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CalendarSubscriptionManager } from '@/components/calendar/CalendarSubscriptionManager';
import { PageHeader } from '@/components/courses/PageHeader';
import {
  formatCalendarDate,
  formatCalendarTime,
  getCalendarPageData,
  getDayParam,
  getMonthParam,
} from '@/lib/calendar';

type CalendarPageProps = {
  searchParams: {
    month?: string;
    day?: string;
  };
};

function buildGridDays(start: Date, end: Date) {
  const days: Date[] = [];
  for (let cursor = new Date(start); cursor <= end;) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const data = await getCalendarPageData(
    session.user.id,
    searchParams.month,
    searchParams.day
  );

  const monthTitle = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(data.month);
  const prevMonth = new Date(
    data.month.getFullYear(),
    data.month.getMonth() - 1,
    1
  );
  const nextMonth = new Date(
    data.month.getFullYear(),
    data.month.getMonth() + 1,
    1
  );
  const monthDays = buildGridDays(data.gridStart, data.gridEnd);
  const selectedDayKey = getDayParam(data.selectedDate);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        description="See assignments, quests, and imported ICS calendars in one working schedule."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
        <section className="card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {monthTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Planner items appear automatically with their due time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/calendar?month=${getMonthParam(prevMonth)}&day=${getDayParam(prevMonth)}`}
                className="btn-secondary text-sm"
              >
                Previous
              </Link>
              <Link
                href={`/dashboard/calendar?month=${getMonthParam(new Date())}&day=${getDayParam(new Date())}`}
                className="btn-secondary text-sm"
              >
                Today
              </Link>
              <Link
                href={`/dashboard/calendar?month=${getMonthParam(nextMonth)}&day=${getDayParam(nextMonth)}`}
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
              const dayKey = getDayParam(day);
              const dayEvents = data.eventsByDay[dayKey] ?? [];
              const isSelected = dayKey === selectedDayKey;
              const isCurrentMonth = day.getMonth() === data.month.getMonth();
              const isToday = sameDay(day, new Date());

              return (
                <Link
                  key={dayKey}
                  href={`/dashboard/calendar?month=${getMonthParam(data.month)}&day=${dayKey}`}
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
                        {event.allDay
                          ? 'All day'
                          : formatCalendarTime(event.startsAt)}{' '}
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
            {formatCalendarDate(data.selectedDate)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Day agenda from your planner plus imported calendars.
          </p>

          {data.selectedDayEvents.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Nothing scheduled for this day yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {data.selectedDayEvents.map((event) => (
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
                          : `${formatCalendarTime(event.startsAt)}${
                              event.endsAt
                                ? ` - ${formatCalendarTime(event.endsAt)}`
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

      <CalendarSubscriptionManager subscriptions={data.subscriptions} />
    </div>
  );
}
