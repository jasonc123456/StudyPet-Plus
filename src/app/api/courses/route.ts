import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { createCourseSchema, zodFirstError } from '@/lib/validators';

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const courses = await prisma.course.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { assignments: true } } },
    });
    return jsonOk(courses);
  } catch (err) {
    console.error('[GET /api/courses]', err);
    return jsonError('Failed to fetch courses', 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(zodFirstError(parsed.error), 400);
    }

    const { name, color, term } = parsed.data;
    const course = await prisma.course.create({
      data: {
        userId: user.id,
        name,
        color,
        term: term || null,
      },
      include: { _count: { select: { assignments: true } } },
    });

    return jsonOk(course, 201);
  } catch (err) {
    console.error('[POST /api/courses]', err);
    return jsonError('Failed to create course', 500);
  }
}
