import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCoursePlannerSection } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import {
  updateCoursePlannerSectionSchema,
  zodFirstError,
} from '@/lib/validators';

type RouteContext = {
  params: { sectionId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedCoursePlannerSection(
    params.sectionId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Section not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateCoursePlannerSectionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const section = await prisma.coursePlannerSection.update({
    where: { id: params.sectionId },
    data: {
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
    },
  });

  return jsonOk(section);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedCoursePlannerSection(
    params.sectionId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Section not found', 404);
  }

  await prisma.coursePlannerSection.delete({
    where: { id: params.sectionId },
  });

  return jsonOk({ success: true });
}
