// GET /api/profile/email/verify?token=...
//
// The link mailed to a user's PROPOSED new address. Clicking it is the proof of
// inbox control that finally applies the email change queued by PUT /api/profile.
// No session is required — the single-use, hashed, 1-hour token IS the
// credential here (same trust model as a magic-link sign-in), so the link works
// even when opened in a browser that isn't signed in.

import { NextResponse } from 'next/server';

import { hashEmailChangeToken } from '@/lib/email-change';
import { prisma } from '@/lib/prisma';

type ResultStatus = 'success' | 'invalid' | 'expired' | 'conflict';

function redirectToResult(request: Request, status: ResultStatus) {
  return NextResponse.redirect(
    new URL(`/email-change?status=${status}`, request.url)
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');

  if (!token) {
    return redirectToResult(request, 'invalid');
  }

  const changeRequest = await prisma.emailChangeRequest.findUnique({
    where: { tokenHash: hashEmailChangeToken(token) },
  });

  if (!changeRequest) {
    return redirectToResult(request, 'invalid');
  }

  // Burn expired requests so a stale link can't be probed repeatedly.
  if (changeRequest.expires.getTime() < Date.now()) {
    await prisma.emailChangeRequest.delete({
      where: { id: changeRequest.id },
    });
    return redirectToResult(request, 'expired');
  }

  // Re-check ownership at confirm time: someone else may have claimed the address
  // in the window since the request was created.
  const emailOwner = await prisma.user.findFirst({
    where: {
      email: changeRequest.newEmail,
      id: { not: changeRequest.userId },
    },
    select: { id: true },
  });

  if (emailOwner) {
    await prisma.emailChangeRequest.delete({
      where: { id: changeRequest.id },
    });
    return redirectToResult(request, 'conflict');
  }

  // Apply the change and consume every pending request for this user in one shot.
  // emailVerified is stamped because the click just proved control of the inbox.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: changeRequest.userId },
      data: {
        email: changeRequest.newEmail,
        emailVerified: new Date(),
      },
    }),
    prisma.emailChangeRequest.deleteMany({
      where: { userId: changeRequest.userId },
    }),
  ]);

  return redirectToResult(request, 'success');
}
