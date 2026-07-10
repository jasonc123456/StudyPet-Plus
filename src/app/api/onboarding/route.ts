import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { onboardingSchema, zodFirstError } from '@/lib/validators';

// First-run onboarding — captures name, time zone, and avatar right after the
// initial sign-in, then stamps `onboardedAt` so the dashboard stops redirecting
// the user here. Remaining profile details are completed later in Settings.
export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { name, timezone, image } = parsed.data;

  const user = await prisma.user.update({
    where: { id: authResult.user.id },
    data: { name, timezone, image, onboardedAt: new Date() },
    select: {
      id: true,
      name: true,
      timezone: true,
      image: true,
      onboardedAt: true,
    },
  });

  return jsonOk({ user });
}
