import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedAssignment } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateAssignmentSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { courseId: string; assignmentId: string };
};

export async function PUT(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedAssignment(
    params.courseId,
    params.assignmentId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Assignment not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { title, description, dueAt, status, type } = parsed.data;

  const assignment = await prisma.assignment.update({
    where: { id: params.assignmentId },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(dueAt !== undefined && { dueAt }),
      ...(status !== undefined && { status }),
      ...(type !== undefined && { type }),
    },
  });

  return jsonOk(assignment);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedAssignment(
    params.courseId,
    params.assignmentId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Assignment not found', 404);
  }

  await prisma.assignment.delete({ where: { id: params.assignmentId } });

  return jsonOk({ success: true });
}
