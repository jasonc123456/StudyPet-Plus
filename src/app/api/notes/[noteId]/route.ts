import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCourse, getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateNoteSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { noteId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const note = await prisma.note.findFirst({
    where: {
      id: params.noteId,
      userId: authResult.user.id,
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  if (!note) {
    return jsonError('Note not found', 404);
  }

  return jsonOk(note);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedNote(params.noteId, authResult.user.id);
  if (!existing) {
    return jsonError('Note not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateNoteSchema.safeParse(body);
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

  const note = await prisma.note.update({
    where: { id: params.noteId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(courseId !== undefined && { courseId }),
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  return jsonOk(note);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedNote(params.noteId, authResult.user.id);
  if (!existing) {
    return jsonError('Note not found', 404);
  }

  await prisma.note.delete({ where: { id: params.noteId } });

  return jsonOk({ success: true });
}
