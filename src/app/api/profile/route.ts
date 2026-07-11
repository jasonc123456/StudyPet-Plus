import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { sendEmailChangeVerification } from '@/lib/email';
import {
  buildEmailChangeVerifyUrl,
  createEmailChangeToken,
  EMAIL_CHANGE_TTL_MS,
} from '@/lib/email-change';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema, zodFirstError } from '@/lib/validators';

export async function PUT(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { name, email, petName, image, timezone } = parsed.data;

  const currentUser = await prisma.user.findUnique({
    where: { id: authResult.user.id },
    select: { email: true },
  });

  if (!currentUser) {
    return jsonError('Account not found', 404);
  }

  // Email is compared case-insensitively so that re-saving the same address in a
  // different case is (correctly) a no-op rather than kicking off a verification.
  const requestedEmail = email.trim();
  const emailChanged =
    requestedEmail.toLowerCase() !== (currentUser.email ?? '').toLowerCase();

  // Everything EXCEPT the email is applied immediately. The email itself is only
  // changed after the user proves they control the new inbox (see below) — a
  // typo here would otherwise silently hand the account to an address the user
  // can't sign in from.
  const [user, pet] = await prisma.$transaction([
    prisma.user.update({
      where: { id: authResult.user.id },
      data: { name, image, timezone },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        timezone: true,
      },
    }),
    prisma.pet.upsert({
      where: { userId: authResult.user.id },
      update: { name: petName },
      create: {
        userId: authResult.user.id,
        name: petName,
      },
      select: {
        name: true,
        xp: true,
        level: true,
        stage: true,
        streakCount: true,
      },
    }),
  ]);

  if (!emailChanged) {
    return jsonOk({ user, pet, emailChangePending: false });
  }

  // Reject up front if another account already owns the requested address, so
  // the user gets an error now instead of a dead-end verification link later.
  const emailOwner = await prisma.user.findFirst({
    where: {
      email: requestedEmail,
      id: { not: authResult.user.id },
    },
    select: { id: true },
  });

  if (emailOwner) {
    return jsonError('That email address is already in use', 409);
  }

  const { token, tokenHash } = createEmailChangeToken();
  const expires = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);

  // Only one pending change per user: replace any earlier request so a superseded
  // link can't later be clicked to switch to a stale address.
  await prisma.$transaction([
    prisma.emailChangeRequest.deleteMany({
      where: { userId: authResult.user.id },
    }),
    prisma.emailChangeRequest.create({
      data: {
        userId: authResult.user.id,
        newEmail: requestedEmail,
        tokenHash,
        expires,
      },
    }),
  ]);

  try {
    await sendEmailChangeVerification({
      to: requestedEmail,
      url: buildEmailChangeVerifyUrl(token),
      currentEmail: currentUser.email,
    });
  } catch {
    // Don't leave a live token pointing at an inbox that never got the link.
    await prisma.emailChangeRequest.deleteMany({
      where: { userId: authResult.user.id },
    });
    return jsonError(
      'Could not send the verification email. Please try again.',
      502
    );
  }

  return jsonOk({
    user,
    pet,
    emailChangePending: true,
    pendingEmail: requestedEmail,
  });
}
