import { NextResponse } from 'next/server';

import { jsonOk, requireUser } from '@/lib/api-response';
import { createRawFeedToken, hashFeedToken } from '@/lib/calendar-export';
import { prisma } from '@/lib/prisma';

// Mint (or rotate) the share link for the user's outbound ICS feed.
//
// The raw token is returned exactly once, here — only its hash is stored, so it
// can never be read back. The client shows the full URL immediately after this
// call; afterwards the user regenerates to get a new one, which is also how
// they revoke access for anyone still subscribed to the old link.
export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const rawToken = createRawFeedToken();

  await prisma.user.update({
    where: { id: authResult.user.id },
    data: { calendarFeedTokenHash: hashFeedToken(rawToken) },
  });

  const origin = new URL(request.url).origin;

  return jsonOk({
    feedUrl: `${origin}/api/calendar/feed/${rawToken}.ics`,
  });
}

/** Revoke the link without issuing a new one. */
export async function DELETE() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  await prisma.user.update({
    where: { id: authResult.user.id },
    data: { calendarFeedTokenHash: null },
  });

  return jsonOk({ success: true });
}
