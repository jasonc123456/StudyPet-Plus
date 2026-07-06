import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
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

  const { name, email, petName, image } = parsed.data;

  const emailOwner = await prisma.user.findFirst({
    where: {
      email,
      id: { not: authResult.user.id },
    },
    select: { id: true },
  });

  if (emailOwner) {
    return jsonError('That email address is already in use', 409);
  }

  const [user, pet] = await prisma.$transaction([
    prisma.user.update({
      where: { id: authResult.user.id },
      data: { name, email, image },
      select: { id: true, name: true, email: true, image: true },
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

  return jsonOk({
    user,
    pet,
  });
}
