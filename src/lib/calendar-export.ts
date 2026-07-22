import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';

// Outbound side of the calendar: serializes the user's planner into an ICS feed
// that Outlook, Google Calendar, or Apple Calendar can subscribe to. The inbound
// direction (reading someone else's ICS) lives in calendar.ts.

/** How far back/forward the exported feed reaches. Calendar apps refetch periodically. */
const EXPORT_PAST_DAYS = 90;
const EXPORT_FUTURE_DAYS = 365;

export function hashFeedToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRawFeedToken() {
  return randomBytes(24).toString('hex');
}

/** RFC 5545 text escaping: backslash, semicolon, comma, and newline. */
function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** `20260722T093000Z` — the UTC form, which needs no VTIMEZONE block. */
function toIcsUtcStamp(date: Date) {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** `20260722` — a floating date, for all-day events. */
function toIcsDateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Fold lines at 75 octets per RFC 5545. Outlook in particular drops properties
 * on over-long lines, which silently loses long assignment descriptions.
 */
function foldIcsLine(line: string) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;

  const parts: string[] = [];
  let current = '';

  for (const char of line) {
    // Continuation lines start with a space, so they carry 74 octets of payload.
    const limit = parts.length === 0 ? 75 : 74;
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  if (current) parts.push(current);

  return parts.join('\r\n ');
}

type ExportableEvent = {
  uid: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  url: string | null;
};

function toVEvent(event: ExportableEvent, stamp: string) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.allDay) {
    // DTEND is exclusive for a DATE value, so a one-day event ends the next day.
    const end = event.endsAt ?? new Date(event.startsAt.getTime() + 86400_000);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDateStamp(event.startsAt)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDateStamp(end)}`);
  } else {
    lines.push(`DTSTART:${toIcsUtcStamp(event.startsAt)}`);
    if (event.endsAt) {
      lines.push(`DTEND:${toIcsUtcStamp(event.endsAt)}`);
    }
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.url) {
    lines.push(`URL:${escapeIcsText(event.url)}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

export function buildIcsDocument(
  events: ExportableEvent[],
  calendarName: string
) {
  const stamp = toIcsUtcStamp(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyPet-Plus//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    // Hint to subscribing clients not to hammer the endpoint.
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ...events.flatMap((event) => toVEvent(event, stamp)),
    'END:VCALENDAR',
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/**
 * Everything the user owns that belongs on an external calendar: course tasks,
 * quests, and their manually added personal events. Imported feed events are
 * deliberately excluded — the subscriber already has that calendar upstream, so
 * re-publishing it would double-book every entry.
 */
export async function collectExportableEvents(
  userId: string,
  origin: string
): Promise<ExportableEvent[]> {
  const now = new Date();
  const rangeStart = new Date(now.getTime() - EXPORT_PAST_DAYS * 86400_000);
  const rangeEnd = new Date(now.getTime() + EXPORT_FUTURE_DAYS * 86400_000);

  const [assignments, quests, personalEvents] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        course: { userId },
        dueAt: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        courseId: true,
        course: { select: { name: true } },
      },
    }),
    prisma.quest.findMany({
      where: { userId, dueAt: { gte: rangeStart, lte: rangeEnd } },
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        estimatedMinutes: true,
      },
    }),
    prisma.personalEvent.findMany({
      where: { userId, startsAt: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);

  return [
    ...assignments.flatMap<ExportableEvent>((assignment) =>
      assignment.dueAt
        ? [
            {
              uid: `assignment-${assignment.id}@studypetplus.app`,
              title: `${assignment.title} (${assignment.course.name})`,
              description: assignment.description,
              startsAt: assignment.dueAt,
              endsAt: null,
              allDay: false,
              url: `${origin}/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}`,
            },
          ]
        : []
    ),
    ...quests.flatMap<ExportableEvent>((quest) =>
      quest.dueAt
        ? [
            {
              uid: `quest-${quest.id}@studypetplus.app`,
              title: quest.title,
              description: quest.description,
              startsAt: quest.dueAt,
              endsAt:
                quest.estimatedMinutes && quest.estimatedMinutes > 0
                  ? new Date(
                      quest.dueAt.getTime() + quest.estimatedMinutes * 60_000
                    )
                  : null,
              allDay: false,
              url: `${origin}/dashboard/quests/${quest.id}/edit`,
            },
          ]
        : []
    ),
    ...personalEvents.map<ExportableEvent>((event) => ({
      uid: `personal-${event.id}@studypetplus.app`,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      url: null,
    })),
  ];
}
