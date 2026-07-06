import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateCourseSchema, zodFirstError } from '@/lib/validators';

type RouteContext = { params: { courseId: string } };

export async function PUT(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const existing = await getOwnedCourse(params.courseId, user.id);
    if (!existing) return jsonError('Course not found', 404);

    const body = await request.json();
    const parsed = updateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(zodFirstError(parsed.error), 400);
    }

    const course = await prisma.course.update({
      where: { id: params.courseId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.color !== undefined && { color: parsed.data.color }),
        ...(parsed.data.term !== undefined && {
          term: parsed.data.term || null,
        }),
      },
      include: { _count: { select: { assignments: true } } },
    });

    return jsonOk(course);
  } catch (err) {
    console.error('[PUT /api/courses/[courseId]]', err);
    return jsonError('Failed to update course', 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const existing = await getOwnedCourse(params.courseId, user.id);
    if (!existing) return jsonError('Course not found', 404);

    await prisma.course.delete({ where: { id: params.courseId } });
    return jsonOk({ success: true });
  } catch (err) {
    console.error('[DELETE /api/courses/[courseId]]', err);
    return jsonError('Failed to delete course', 500);
  }
}
