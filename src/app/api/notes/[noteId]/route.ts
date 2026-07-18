import { NextResponse } from 'next/server';
import type { Note } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { sanitizeRichTextHtml } from '@/lib/note-rich-text';
import { deleteNotePdf, finalizeNotePdfUpload } from '@/lib/note-pdf';
import { getOwnedCourse, getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import {
  updateNoteSchema,
  zodFirstError,
  type UpdateNoteInput,
} from '@/lib/validators';

type RouteContext = {
  params: { noteId: string };
};

type PdfResolution = {
  nextPdfName: string | null | undefined;
  nextPdfUrl: string | null | undefined;
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

  const parsed = await parseUpdateNoteBody(request);
  if (parsed instanceof NextResponse) return parsed;

  const courseError = await ensureOwnedCourseIfPresent(
    parsed.courseId,
    authResult.user.id
  );
  if (courseError) return courseError;

  const pdfFields = await resolvePdfUpdateFields({
    userId: authResult.user.id,
    existing,
    input: parsed,
  });
  if (pdfFields instanceof NextResponse) return pdfFields;

  const note = await persistNoteUpdate({
    noteId: params.noteId,
    input: parsed,
    pdf: pdfFields,
  });

  await cleanupReplacedPdf({
    existingPdfUrl: existing.pdfUrl,
    requestedPdfUrl: parsed.pdfUrl,
    nextPdfUrl: pdfFields.nextPdfUrl,
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
  await deleteNotePdf(existing.pdfUrl);

  return jsonOk({ success: true });
}

/** Parse JSON + Zod validation for PATCH bodies. */
async function parseUpdateNoteBody(
  request: Request
): Promise<UpdateNoteInput | NextResponse> {
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

  return parsed.data;
}

/** When courseId is a non-null id, require ownership; null/undefined skip. */
async function ensureOwnedCourseIfPresent(
  courseId: UpdateNoteInput['courseId'],
  userId: string
): Promise<NextResponse | null> {
  if (!courseId) return null;

  const course = await getOwnedCourse(courseId, userId);
  if (!course) {
    return jsonError('Course not found', 404);
  }

  return null;
}

/**
 * Resolve next pdfName/pdfUrl for the update, finalizing uploads when needed.
 * Mirrors prior PATCH branching exactly (including clear-on-null).
 */
async function resolvePdfUpdateFields(args: {
  userId: string;
  existing: Note;
  input: UpdateNoteInput;
}): Promise<PdfResolution | NextResponse> {
  const { userId, existing, input } = args;
  const { pdfName, pdfUrl, pdfToken } = input;

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
        userId,
        pdfUrl,
        pdfToken,
      });
      nextPdfUrl = finalized.pdfUrl;
    } catch (error) {
      return jsonError(pdfFinalizeErrorMessage(error), 400);
    }
  }

  if (pdfUrl === null) {
    nextPdfName = null;
    nextPdfUrl = null;
  }

  return { nextPdfName, nextPdfUrl };
}

function pdfFinalizeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Failed to finalize uploaded PDF';
}

async function persistNoteUpdate(args: {
  noteId: string;
  input: UpdateNoteInput;
  pdf: PdfResolution;
}) {
  const { noteId, input, pdf } = args;
  const { title, content, courseId, pdfName, pdfUrl } = input;

  return prisma.note.update({
    where: { id: noteId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content: sanitizeRichTextHtml(content) }),
      ...(courseId !== undefined && { courseId }),
      ...(pdfName !== undefined && { pdfName: pdf.nextPdfName ?? null }),
      ...(pdfUrl !== undefined && { pdfUrl: pdf.nextPdfUrl ?? null }),
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });
}

/** Delete the previous attachment when the stored URL actually changes. */
async function cleanupReplacedPdf(args: {
  existingPdfUrl: string | null;
  requestedPdfUrl: UpdateNoteInput['pdfUrl'];
  nextPdfUrl: string | null | undefined;
}): Promise<void> {
  const { existingPdfUrl, requestedPdfUrl, nextPdfUrl } = args;

  if (
    requestedPdfUrl !== undefined &&
    existingPdfUrl &&
    existingPdfUrl !== (nextPdfUrl ?? null)
  ) {
    await deleteNotePdf(existingPdfUrl);
  }
}
