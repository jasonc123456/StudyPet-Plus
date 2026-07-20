import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const courseId = searchParams.get('courseId');

    const assignments = await prisma.assignment.findMany({
      where: {
        course: { userId: authResult.user.id },
        ...(status && { status }),
        ...(type && { type }),
        ...(courseId && { courseId }),
      },
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });

    return jsonOk(assignments);
  } catch (error) {
    console.error('GET /api/assignments', error);
    return jsonError('Failed to load assignments', 500);
  }
}
