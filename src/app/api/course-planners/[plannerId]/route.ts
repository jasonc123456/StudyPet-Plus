import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCoursePlanner } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateCoursePlannerSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { plannerId: string };
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedCoursePlanner(
    params.plannerId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Planner not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateCoursePlannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const planner = await prisma.coursePlanner.update({
    where: { id: params.plannerId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.system !== undefined && { system: parsed.data.system }),
    },
  });

  return jsonOk(planner);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedCoursePlanner(
    params.plannerId,
    authResult.user.id
  );
  if (!existing) {
    return jsonError('Planner not found', 404);
  }

  await prisma.coursePlanner.delete({
    where: { id: params.plannerId },
  });

  return jsonOk({ success: true });
}
