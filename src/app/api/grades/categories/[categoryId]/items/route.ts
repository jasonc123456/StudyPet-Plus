import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedAssignment, getOwnedGradeCategory } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { createGradeItemSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { categoryId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const category = await getOwnedGradeCategory(
    params.categoryId,
    authResult.user.id
  );
  if (!category) {
    return jsonError('Grade category not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGradeItemSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  if (parsed.data.assignmentId) {
    const assignment = await getOwnedAssignment(
      category.courseId,
      parsed.data.assignmentId,
      authResult.user.id
    );
    if (!assignment) {
      return jsonError('Task not found for this course', 404);
    }
  }

  const item = await prisma.gradeItem.create({
    data: {
      categoryId: params.categoryId,
      assignmentId: parsed.data.assignmentId,
      title: parsed.data.title,
      scoreEarned: parsed.data.scoreEarned,
      scorePossible: parsed.data.scorePossible,
      notes: parsed.data.notes ?? null,
      gradedAt: parsed.data.gradedAt ?? new Date(),
    },
  });

  return jsonOk(item, 201);
}
