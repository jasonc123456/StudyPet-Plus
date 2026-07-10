import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedGradeCategory } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateGradeCategorySchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { categoryId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedGradeCategory(
    params.categoryId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Grade category not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateGradeCategorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const category = await prisma.gradeCategory.update({
    where: { id: params.categoryId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.weight !== undefined && { weight: parsed.data.weight }),
    },
  });

  return jsonOk(category);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedGradeCategory(
    params.categoryId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Grade category not found', 404);
  }

  await prisma.gradeCategory.delete({
    where: { id: params.categoryId },
  });

  return jsonOk({ success: true });
}
