import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createStarterSectionsForPlanner } from '@/lib/course-planners';
import { prisma } from '@/lib/prisma';
import { createCoursePlannerSchema, zodFirstError } from '@/lib/validators';

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const plannerDelegate = (
    prisma as typeof prisma & {
      coursePlanner?: typeof prisma.coursePlanner;
    }
  ).coursePlanner;

  if (!plannerDelegate) {
    return jsonOk([]);
  }

  const planners = await plannerDelegate.findMany({
    where: { userId: authResult.user.id },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      sections: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          courses: {
            orderBy: [{ isAlternate: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });

  return jsonOk(planners);
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createCoursePlannerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const plannerDelegate = (
    prisma as typeof prisma & {
      coursePlanner?: typeof prisma.coursePlanner;
    }
  ).coursePlanner;

  if (!plannerDelegate) {
    return jsonError(
      'Course planner tables are not available yet. Run Prisma migrations first.',
      503
    );
  }

  const planner = await plannerDelegate.create({
    data: {
      userId: authResult.user.id,
      title: parsed.data.title,
      system: parsed.data.system,
    },
  });

  await createStarterSectionsForPlanner(planner.id, parsed.data.system);

  const createdPlanner = await plannerDelegate.findFirst({
    where: { id: planner.id, userId: authResult.user.id },
    include: {
      sections: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          courses: {
            orderBy: [{ isAlternate: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });

  return jsonOk(createdPlanner, 201);
}
