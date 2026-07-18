import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { sanitizeRichTextHtml } from '@/lib/note-rich-text';
import { getOwnedCourse } from '@/lib/planner';
import { finalizeNotePdfUpload } from '@/lib/note-pdf';
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

  const { title, content, courseId, pdfName, pdfUrl, pdfToken } = parsed.data;

  if (courseId) {
    const course = await getOwnedCourse(courseId, authResult.user.id);
    if (!course) {
      return jsonError('Course not found', 404);
    }
  }

  let finalizedPdfUrl: string | null = null;
  if (pdfUrl || pdfName || pdfToken) {
    if (!pdfUrl || !pdfName || !pdfToken) {
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
      finalizedPdfUrl = finalized.pdfUrl;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to finalize uploaded PDF';
      return jsonError(message, 400);
    }
  }

  const note = await prisma.note.create({
    data: {
      userId: authResult.user.id,
      title,
      content: sanitizeRichTextHtml(content ?? ''),
      courseId,
      pdfName: pdfName ?? null,
      pdfUrl: finalizedPdfUrl,
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });

  return jsonOk(note, 201);
}
