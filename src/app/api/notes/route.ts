import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { createNoteSchema, zodFirstError } from '@/lib/validators';

export async function GET(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');

  if (courseId) {
    const course = await getOwnedCourse(courseId, authResult.user.id);
    if (!course) {
      return jsonError('Course not found', 404);
    }
  }

  const notes = await prisma.note.findMany({
    where: {
      userId: authResult.user.id,
      ...(courseId && { courseId }),
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return jsonOk(notes);
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

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { title, content, courseId } = parsed.data;

  if (courseId) {
    const course = await getOwnedCourse(courseId, authResult.user.id);
    if (!course) {
      return jsonError('Course not found', 404);
    }
  }

  const note = await prisma.note.create({
    data: {
      userId: authResult.user.id,
      title,
      content: content ?? '',
      courseId,
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  return jsonOk(note, 201);
}
