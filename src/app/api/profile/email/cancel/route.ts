// /api/profile/email/cancel
//
// Revokes a pending email change. The link that reaches here is mailed to the
// address the account is moving AWAY from (see sendEmailChangeAlert), which is
// the point: an identity change made from a stolen session can be killed from
// the mailbox that still works, without waiting out the TTL.
//
// Same shape as the confirm route next door, and for the same reasons. The
// mutation lives only on POST because Office 365 "Safe Links" and prefetchers
// GET the link before a human sees it. No session is required — the hashed,
// single-use, 1-hour token is the credential, so this works from a signed-out
// browser or a phone that has never seen the app.

import { NextResponse } from 'next/server';

import { absoluteUrl, hashEmailChangeToken } from '@/lib/email-change';
import { prisma } from '@/lib/prisma';

function resultRedirect(status: 'cancelled' | 'invalid') {
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
  try {
    const token = await readToken(request);

    if (!token) {
      return resultRedirect('invalid');
    }

    // deleteMany, not delete: cancelling an already-gone request is not an
    // error worth surfacing, and a count of zero is indistinguishable from a
    // token that never existed — which is what we want to tell a prober.
    const { count } = await prisma.emailChangeRequest.deleteMany({
      where: { tokenHash: hashEmailChangeToken(token) },
    });

    return resultRedirect(count > 0 ? 'cancelled' : 'invalid');
  } catch (error) {
    console.error('POST /api/profile/email/cancel', error);
    return resultRedirect('invalid');
  }
}

// Any GET — a Safe Links scan, a prefetch, an old link — lands on the
// read-only page instead. The token is only ever spent on POST.
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    return NextResponse.redirect(
      absoluteUrl(
        token
          ? `/email-change/cancel?token=${token}`
          : '/email-change?status=invalid'
      )
    );
  } catch (error) {
    console.error('GET /api/profile/email/cancel', error);
    return NextResponse.redirect(absoluteUrl('/email-change?status=invalid'));
  }
}
