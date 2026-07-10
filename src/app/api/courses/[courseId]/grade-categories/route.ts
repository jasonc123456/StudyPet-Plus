import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { createGradeCategorySchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { courseId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const course = await getOwnedCourse(params.courseId, authResult.user.id);
  if (!course) {
    return jsonError('Course not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGradeCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const category = await prisma.gradeCategory.create({
    data: {
      courseId: params.courseId,
      name: parsed.data.name,
      weight: parsed.data.weight,
    },
  });

  return jsonOk(category, 201);
}
