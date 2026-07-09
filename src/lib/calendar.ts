import { Prisma } from '@prisma/client';

import { isMissingGroupTables } from '@/lib/groups';
import { prisma } from '@/lib/prisma';

export type CalendarEventSource =
  'assignment' | 'quest' | 'group_task' | 'imported';

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
  lastSyncedAt: Date | null;
  syncError: string | null;
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
};

type ParsedIcsEvent = {
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

function isMissingCalendarSubscriptionTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.message === 'string' &&
    error.message.includes('CalendarSubscription')
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
    return { date: new Date(year, month, day), allDay: true };
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

  const interval = Math.max(1, Number(rule.INTERVAL ?? '1'));
  const countLimit = rule.COUNT ? Number(rule.COUNT) : null;
  const untilInfo = rule.UNTIL
    ? parseIcsTimestamp(rule.UNTIL, {})
    : { date: null, allDay: false };
  const until = untilInfo.date;
  const durationMs = eventDurationMs(event);
  const occurrences: ParsedIcsEvent[] = [];
  let generated = 0;

  const pushOccurrence = (start: Date) => {
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

      if (startsAtInfo.date && current.SUMMARY?.value) {
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

async function fetchSubscriptionEvents(
  subscription: {
    id: string;
    name: string;
    icsUrl: string;
    color: string;
    lastSyncedAt: Date | null;
  },
  rangeStart: Date,
  rangeEnd: Date
) {
  try {
    const response = await fetch(subscription.icsUrl, {
      next: { revalidate: 300 },
      headers: {
        Accept: 'text/calendar,text/plain;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Calendar responded with ${response.status}`);
    }

    const icsText = await response.text();
    const parsedEvents = parseIcsEvents(icsText);
    const events = parsedEvents
      .flatMap((event) => expandRecurringEvent(event, rangeStart, rangeEnd))
      .filter((event) =>
        intersectsRange(event.startsAt, event.endsAt, rangeStart, rangeEnd)
      )
      .map<CalendarEvent>((event, index) => ({
        id: `imported-${subscription.id}-${event.uid}-${index}`,
        source: 'imported',
        sourceId: subscription.id,
        title: event.summary,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
        status: null,
        color: subscription.color || DEFAULT_IMPORTED_COLOR,
        description: event.description,
        href: null,
        meta: subscription.name,
      }));

    return {
      events,
      subscription: { ...subscription, syncError: null as string | null },
    };
  } catch (error) {
    return {
      events: [] as CalendarEvent[],
      subscription: {
        ...subscription,
        syncError:
          error instanceof Error ? error.message : 'Calendar sync failed',
      },
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
        lastSyncedAt: true,
      },
    });
  } catch (error) {
    if (isMissingCalendarSubscriptionTable(error)) {
      return [];
    }
    throw error;
  }
}

async function loadAssignedGroupTasks(
  userId: string,
  gridStart: Date,
  gridEnd: Date
) {
  try {
    return await prisma.groupTaskAssignee.findMany({
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

export async function getCalendarPageData(
  userId: string,
  monthParam?: string,
  dayParam?: string
): Promise<CalendarPageData> {
  const month = parseMonthParam(monthParam);
  const selectedDate = parseDayParam(dayParam, month);
  const { gridStart, gridEnd } = getCalendarGridRange(month);

  const [assignments, quests, assignedGroupTasks, subscriptions] =
    await Promise.all([
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
      loadAssignedGroupTasks(userId, gridStart, gridEnd),
      loadCalendarSubscriptions(userId),
    ]);

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
              href: `/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}/edit`,
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
            },
          ]
        : []
    ),
    ...assignedGroupTasks.flatMap((assignment) =>
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
            },
          ]
        : []
    ),
  ];

  const importedResults = await Promise.all(
    subscriptions.map((subscription) =>
      fetchSubscriptionEvents(subscription, gridStart, gridEnd)
    )
  );

  const importedEvents = importedResults.flatMap((result) => result.events);
  const syncedSubscriptions = importedResults.map(
    (result) => result.subscription
  );

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
              href: `/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}/edit`,
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
