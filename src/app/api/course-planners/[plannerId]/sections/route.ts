import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCoursePlanner } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import {
  createCoursePlannerSectionSchema,
  zodFirstError,
} from '@/lib/validators';

type RouteContext = {
  params: { plannerId: string };
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const planner = await getOwnedCoursePlanner(
    params.plannerId,
    authResult.user.id
  );
  if (!planner) {
    return jsonError('Planner not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createCoursePlannerSectionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const sortOrder = await prisma.coursePlannerSection.count({
    where: { plannerId: params.plannerId },
  });

  const section = await prisma.coursePlannerSection.create({
    data: {
      plannerId: params.plannerId,
      label: parsed.data.label,
      sortOrder,
    },
    include: {
      courses: {
        orderBy: [{ isAlternate: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  return jsonOk(section, 201);
}
