import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse } from '@/lib/planner';
import {
  buildNoteListWhere,
  noteListOrderBy,
  parseNoteSort,
} from '@/lib/notes-query';
import { prisma } from '@/lib/prisma';
import { createNoteSchema, zodFirstError } from '@/lib/validators';

export async function GET(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') ?? undefined;
  const q = searchParams.get('q') ?? undefined;
  const sort = parseNoteSort(searchParams.get('sort') ?? undefined);

  if (courseId && courseId !== 'none') {
    const course = await getOwnedCourse(courseId, authResult.user.id);
    if (!course) {
      return jsonError('Course not found', 404);
    }
  }

  const notes = await prisma.note.findMany({
    where: buildNoteListWhere(authResult.user.id, { courseId, q }),
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
    orderBy: noteListOrderBy(sort),
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

  const { title, content, courseId, pdfName, pdfUrl } = parsed.data;

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
      pdfName: pdfName ?? null,
      pdfUrl: pdfUrl ?? null,
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  return jsonOk(note, 201);
}
