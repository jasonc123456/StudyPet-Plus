import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { deleteNotePdf, finalizeNotePdfUpload } from '@/lib/note-pdf';
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

  const { title, content, courseId, pdfName, pdfUrl, pdfToken } = parsed.data;

  if (courseId) {
    const course = await getOwnedCourse(courseId, authResult.user.id);
    if (!course) {
      return jsonError('Course not found', 404);
    }
  }

  let nextPdfUrl = pdfUrl;
  let nextPdfName = pdfName;

  const pdfChanged =
    pdfUrl !== undefined &&
    (pdfUrl !== existing.pdfUrl ||
      (pdfName ?? null) !== (existing.pdfName ?? null));

  if (pdfChanged && pdfUrl) {
    if (!pdfName || !pdfToken) {
      return jsonError(
        'Uploaded PDF is incomplete. Please upload it again.',
        400
      );
    }

    try {
      const finalized = await finalizeNotePdfUpload({
        userId: authResult.user.id,
        pdfUrl,
        pdfToken,
      });
      nextPdfUrl = finalized.pdfUrl;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to finalize uploaded PDF';
      return jsonError(message, 400);
    }
  }

  if (pdfUrl === null) {
    nextPdfName = null;
    nextPdfUrl = null;
  }

  const note = await prisma.note.update({
    where: { id: params.noteId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(courseId !== undefined && { courseId }),
      ...(pdfName !== undefined && { pdfName: nextPdfName ?? null }),
      ...(pdfUrl !== undefined && { pdfUrl: nextPdfUrl ?? null }),
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  if (
    pdfUrl !== undefined &&
    existing.pdfUrl &&
    existing.pdfUrl !== (nextPdfUrl ?? null)
  ) {
    await deleteNotePdf(existing.pdfUrl);
  }

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
  await deleteNotePdf(existing.pdfUrl);

  return jsonOk({ success: true });
}
