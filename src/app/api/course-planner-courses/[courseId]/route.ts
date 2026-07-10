import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedPlannedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updatePlannedCourseSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { courseId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedPlannedCourse(
    params.courseId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Planned course not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updatePlannedCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const course = await prisma.plannedCourse.update({
    where: { id: params.courseId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.courseNumber !== undefined && {
        courseNumber: parsed.data.courseNumber ?? null,
      }),
      ...(parsed.data.units !== undefined && {
        units: parsed.data.units ?? null,
      }),
      ...(parsed.data.professor !== undefined && {
        professor: parsed.data.professor ?? null,
      }),
      ...(parsed.data.lectureDays !== undefined && {
        lectureDays: parsed.data.lectureDays ?? null,
      }),
      ...(parsed.data.lectureTime !== undefined && {
        lectureTime: parsed.data.lectureTime ?? null,
      }),
      ...(parsed.data.lectureLocation !== undefined && {
        lectureLocation: parsed.data.lectureLocation ?? null,
      }),
      ...(parsed.data.isAlternate !== undefined && {
        isAlternate: parsed.data.isAlternate,
      }),
      ...(parsed.data.notes !== undefined && {
        notes: parsed.data.notes ?? null,
      }),
    },
  });

  return jsonOk(course);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedPlannedCourse(
    params.courseId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Planned course not found', 404);
  }

  await prisma.plannedCourse.delete({
    where: { id: params.courseId },
  });

  return jsonOk({ success: true });
}
