import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { createGradeScaleEntrySchema, zodFirstError } from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGradeScaleEntrySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const sortOrder = await prisma.gradeScaleEntry.count({
    where: { userId: authResult.user.id },
  });

  const entry = await prisma.gradeScaleEntry.create({
    data: {
      userId: authResult.user.id,
      label: parsed.data.label,
      minPercent: parsed.data.minPercent,
      maxPercent: parsed.data.maxPercent,
      gpaPoints: parsed.data.gpaPoints,
      sortOrder,
    },
  });

  return jsonOk(entry, 201);
}
