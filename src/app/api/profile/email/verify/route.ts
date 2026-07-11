// /api/profile/email/verify
//
// Applies the email change queued by PUT /api/profile. The mutation lives ONLY
// on POST (submitted by the confirm page's form) — never on GET — because the
// emailed link is fetched automatically by Office 365 "Safe Links" scanning and
// browser prefetchers before the human clicks. A mutating GET would let those
// automated fetches consume the one-time token and silently apply the change,
// leaving the real click to fail as "invalid" (exactly the bug this fixes).
//
// No session is required — the single-use, hashed, 1-hour token IS the
// credential here (same trust model as a magic-link sign-in), so it works even
// when opened in a browser that isn't signed in.

import { NextResponse } from 'next/server';

import { absoluteUrl, hashEmailChangeToken } from '@/lib/email-change';
import { prisma } from '@/lib/prisma';

type ResultStatus = 'success' | 'invalid' | 'expired' | 'conflict';

function resultRedirect(status: ResultStatus) {
  // 303 so the browser issues a GET for the result page after this POST.
  return NextResponse.redirect(
    absoluteUrl(`/email-change?status=${status}`),
    303
  );
}

async function readToken(request: Request): Promise<string | null> {
  const token = (await request.formData().catch(() => null))?.get('token');
  return typeof token === 'string' ? token : null;
}

export async function POST(request: Request) {
  const token = await readToken(request);

  if (!token) {
    return resultRedirect('invalid');
  }

  const changeRequest = await prisma.emailChangeRequest.findUnique({
    where: { tokenHash: hashEmailChangeToken(token) },
  });

  if (!changeRequest) {
    return resultRedirect('invalid');
  }

  // Burn expired requests so a stale link can't be probed repeatedly.
  if (changeRequest.expires.getTime() < Date.now()) {
    await prisma.emailChangeRequest.delete({
      where: { id: changeRequest.id },
    });
    return resultRedirect('expired');
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
    return resultRedirect('conflict');
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

  return resultRedirect('success');
}

// Any GET here — an old in-flight email link, a Safe Links scan, a prefetch — is
// bounced to the confirm PAGE without touching the database. The token is only
// ever spent on POST.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  return NextResponse.redirect(
    absoluteUrl(
      token
        ? `/email-change/confirm?token=${token}`
        : '/email-change?status=invalid'
    )
  );
}
