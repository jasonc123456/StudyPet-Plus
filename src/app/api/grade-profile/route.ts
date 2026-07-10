import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { updateGradeProfileSchema, zodFirstError } from '@/lib/validators';

export async function PATCH(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGradeProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const profile = await prisma.gradeProfile.upsert({
    where: { userId: authResult.user.id },
    update: {
      currentGpa: parsed.data.currentGpa,
      completedCredits: parsed.data.completedCredits,
    },
    create: {
      userId: authResult.user.id,
      currentGpa: parsed.data.currentGpa,
      completedCredits: parsed.data.completedCredits,
    },
  });

  return jsonOk(profile);
}
