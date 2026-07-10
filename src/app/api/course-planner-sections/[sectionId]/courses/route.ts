import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCoursePlannerSection } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { createPlannedCourseSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { sectionId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const section = await getOwnedCoursePlannerSection(
    params.sectionId,
    authResult.user.id
  );
  if (!section) {
    return jsonError('Section not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createPlannedCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const course = await prisma.plannedCourse.create({
    data: {
      sectionId: params.sectionId,
      title: parsed.data.title,
      courseNumber: parsed.data.courseNumber ?? null,
      units: parsed.data.units ?? null,
      professor: parsed.data.professor ?? null,
      lectureDays: parsed.data.lectureDays ?? null,
      lectureTime: parsed.data.lectureTime ?? null,
      lectureLocation: parsed.data.lectureLocation ?? null,
      isAlternate: parsed.data.isAlternate ?? false,
      notes: parsed.data.notes ?? null,
    },
  });

  return jsonOk(course, 201);
}
