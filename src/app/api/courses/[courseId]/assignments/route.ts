import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { createAssignmentSchema, zodFirstError } from '@/lib/validators';

type RouteContext = { params: { courseId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const course = await getOwnedCourse(params.courseId, user.id);
    if (!course) return jsonError('Course not found', 404);

    const assignments = await prisma.assignment.findMany({
      where: { courseId: params.courseId },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
    });

    return jsonOk(assignments);
  } catch (err) {
    console.error('[GET /api/courses/[courseId]/assignments]', err);
    return jsonError('Failed to fetch assignments', 500);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const course = await getOwnedCourse(params.courseId, user.id);
    if (!course) return jsonError('Course not found', 404);

    const body = await request.json();
    const parsed = createAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(zodFirstError(parsed.error), 400);
    }

    const { title, description, dueAt, status, type } = parsed.data;
    const assignment = await prisma.assignment.create({
      data: {
        courseId: params.courseId,
        title,
        description: description || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        status,
        type,
      },
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
    });

    return jsonOk(assignment, 201);
  } catch (err) {
    console.error('[POST /api/courses/[courseId]/assignments]', err);
    return jsonError('Failed to create assignment', 500);
  }
}
