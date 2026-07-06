import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedAssignment } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateAssignmentSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { courseId: string; assignmentId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const assignment = await getOwnedAssignment(
      params.courseId,
      params.assignmentId,
      user.id
    );
    if (!assignment) return jsonError('Assignment not found', 404);
    return jsonOk(assignment);
  } catch (err) {
    console.error('[GET /api/courses/.../assignments/[assignmentId]]', err);
    return jsonError('Failed to fetch assignment', 500);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const existing = await getOwnedAssignment(
      params.courseId,
      params.assignmentId,
      user.id
    );
    if (!existing) return jsonError('Assignment not found', 404);

    const body = await request.json();
    const parsed = updateAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(zodFirstError(parsed.error), 400);
    }

    const assignment = await prisma.assignment.update({
      where: { id: params.assignmentId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description || null,
        }),
        ...(parsed.data.dueAt !== undefined && {
          dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
      },
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
    });

    return jsonOk(assignment);
  } catch (err) {
    console.error('[PUT /api/courses/.../assignments/[assignmentId]]', err);
    return jsonError('Failed to update assignment', 500);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const existing = await getOwnedAssignment(
      params.courseId,
      params.assignmentId,
      user.id
    );
    if (!existing) return jsonError('Assignment not found', 404);

    await prisma.assignment.delete({ where: { id: params.assignmentId } });
    return jsonOk({ success: true });
  } catch (err) {
    console.error('[DELETE /api/courses/.../assignments/[assignmentId]]', err);
    return jsonError('Failed to delete assignment', 500);
  }
}
