import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { createAssignmentSchema, zodFirstError } from '@/lib/validators';

type RouteContext = { params: { courseId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const course = await getOwnedCourse(params.courseId, authResult.user.id);
  if (!course) {
    return jsonError('Course not found', 404);
  }

  const assignments = await prisma.assignment.findMany({
    where: { courseId: params.courseId },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  return jsonOk(assignments);
}

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
      dueAt,
      status,
      type,
    },
  });

  return jsonOk(assignment, 201);
}
