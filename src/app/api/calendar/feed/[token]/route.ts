import {
  buildIcsDocument,
  collectExportableEvents,
  hashFeedToken,
} from '@/lib/calendar-export';
import { prisma } from '@/lib/prisma';
import { siteOrigin } from '@/lib/site-url';

// Public by design: calendar apps (Outlook, Google, Apple) fetch this URL with
// no cookies or auth headers, so the unguessable token in the path *is* the
// credential. It is stored hashed, scoped to read-only calendar data, and the
// user can rotate it from the calendar page to cut off old subscribers.
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { token: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  // Calendar clients are happier with a URL that ends in .ics; accept both.
  const rawToken = params.token.replace(/\.ics$/i, '');

  if (!/^[a-f0-9]{48}$/i.test(rawToken)) {
    return new Response('Not found', { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { calendarFeedTokenHash: hashFeedToken(rawToken) },
    select: { id: true, name: true },
  });

  if (!user) {
    return new Response('Not found', { status: 404 });
  }

  const events = await collectExportableEvents(user.id, siteOrigin());
  const calendarName = user.name
    ? `StudyPet+ · ${user.name}`
    : 'StudyPet+ Calendar';

  return new Response(buildIcsDocument(events, calendarName), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="studypet-plus.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
