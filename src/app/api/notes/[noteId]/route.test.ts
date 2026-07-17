/**
 * Characterization tests for PATCH /api/notes/[noteId].
 * Locks current observable behavior before any complexity refactor.
 */

import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-response', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-response')>(
      '@/lib/api-response'
    );
  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock('@/lib/planner', () => ({
  getOwnedNote: vi.fn(),
  getOwnedCourse: vi.fn(),
}));

vi.mock('@/lib/note-pdf', () => ({
  finalizeNotePdfUpload: vi.fn(),
  deleteNotePdf: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    note: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

import { requireUser } from '@/lib/api-response';
import { deleteNotePdf, finalizeNotePdfUpload } from '@/lib/note-pdf';
import { getOwnedCourse, getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';

import { PATCH } from './route';

const requireUserMock = vi.mocked(requireUser);
const getOwnedNoteMock = vi.mocked(getOwnedNote);
const getOwnedCourseMock = vi.mocked(getOwnedCourse);
const finalizeNotePdfUploadMock = vi.mocked(finalizeNotePdfUpload);
const deleteNotePdfMock = vi.mocked(deleteNotePdf);
const noteUpdateMock = vi.mocked(prisma.note.update);

const USER_ID = 'user_owner_1';
const NOTE_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const COURSE_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';

const existingNote = {
  id: NOTE_ID,
  userId: USER_ID,
  courseId: null as string | null,
  title: 'Original title',
  content: 'Original content',
  pdfName: null as string | null,
  pdfUrl: null as string | null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

type NoteRow = typeof existingNote;

function authOk() {
  requireUserMock.mockResolvedValue({
    user: { id: USER_ID, email: 'owner@example.com' },
  } as Awaited<ReturnType<typeof requireUser>>);
}

function authUnauthorized() {
  requireUserMock.mockResolvedValue(
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  );
}

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost/api/notes/${NOTE_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function invalidJsonRequest(): Request {
  return new Request(`http://localhost/api/notes/${NOTE_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  });
}

async function readJson(res: Response) {
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

function mockUpdatedNote(overrides: Partial<NoteRow> = {}) {
  return {
    ...existingNote,
    ...overrides,
    course: null,
  };
}

describe('PATCH /api/notes/[noteId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnedNoteMock.mockResolvedValue(existingNote as never);
    getOwnedCourseMock.mockResolvedValue({
      id: COURSE_ID,
      userId: USER_ID,
      name: 'CSE 102',
      color: '#112233',
      term: null,
      credits: 0,
      archivedAt: null,
      archiveReason: null,
      createdAt: new Date(),
    } as never);
    noteUpdateMock.mockImplementation(async (args) => {
      const data = (args as { data: Partial<NoteRow> }).data;
      return mockUpdatedNote(data) as never;
    });
    finalizeNotePdfUploadMock.mockResolvedValue({
      pdfUrl: '/api/notes/files/file-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf',
    });
    deleteNotePdfMock.mockResolvedValue(undefined);
  });

  it('returns 401 when the request is unauthenticated', async () => {
    authUnauthorized();

    const res = await PATCH(patchRequest({ title: 'Nope' }), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(getOwnedNoteMock).not.toHaveBeenCalled();
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the note does not exist for the user', async () => {
    authOk();
    getOwnedNoteMock.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ title: 'Updated' }), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Note not found' });
    expect(getOwnedNoteMock).toHaveBeenCalledWith(NOTE_ID, USER_ID);
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 404 when another user cannot access the note (ownership filter)', async () => {
    authOk();
    // getOwnedNote scopes by userId — missing ownership looks like not found.
    getOwnedNoteMock.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ title: 'Stolen' }), {
      params: { noteId: 'clotherusersnoteidxxxxxxxxx' },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Note not found' });
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is not valid JSON', async () => {
    authOk();

    const res = await PATCH(invalidJsonRequest(), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Invalid JSON body' });
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('accepts an empty object body because content defaults to empty string', async () => {
    // Current Zod updateNoteSchema: content is optional().default(''), so {}
    // parses as { content: '' } and passes "at least one field" refine.
    authOk();
    noteUpdateMock.mockResolvedValue(mockUpdatedNote({ content: '' }) as never);

    const res = await PATCH(patchRequest({}), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ content: '' });
    expect(noteUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: '' }),
      })
    );
  });

  it('returns 400 when pdfToken has an invalid length', async () => {
    authOk();

    const res = await PATCH(
      patchRequest({
        pdfName: 'lecture.pdf',
        pdfUrl:
          '/api/notes/files/file-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf',
        pdfToken: 'too-short',
      }),
      { params: { noteId: NOTE_ID } }
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when title fails validation', async () => {
    authOk();

    const res = await PATCH(patchRequest({ title: '' }), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Title is required' });
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when pdfName is set without pdfUrl', async () => {
    authOk();

    const res = await PATCH(
      patchRequest({ pdfName: 'notes.pdf', pdfUrl: null }),
      { params: { noteId: NOTE_ID } }
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'PDF name and file reference must be saved together',
    });
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 404 when courseId is set but the course is not owned', async () => {
    authOk();
    getOwnedCourseMock.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ courseId: COURSE_ID }), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Course not found' });
    expect(getOwnedCourseMock).toHaveBeenCalledWith(COURSE_ID, USER_ID);
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('updates title and content for the owning user', async () => {
    authOk();
    noteUpdateMock.mockResolvedValue(
      mockUpdatedNote({ title: 'New title', content: 'New content' }) as never
    );

    const res = await PATCH(
      patchRequest({ title: 'New title', content: 'New content' }),
      { params: { noteId: NOTE_ID } }
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: NOTE_ID,
      title: 'New title',
      content: 'New content',
    });
    expect(noteUpdateMock).toHaveBeenCalledWith({
      where: { id: NOTE_ID },
      data: {
        title: 'New title',
        content: 'New content',
      },
      include: {
        course: { select: { id: true, name: true, color: true } },
      },
    });
    expect(deleteNotePdfMock).not.toHaveBeenCalled();
  });

  it('allows clearing courseId (uncategorized note)', async () => {
    authOk();
    getOwnedNoteMock.mockResolvedValue({
      ...existingNote,
      courseId: COURSE_ID,
    } as never);
    noteUpdateMock.mockResolvedValue(
      mockUpdatedNote({ courseId: null }) as never
    );

    const res = await PATCH(patchRequest({ courseId: null }), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ courseId: null });
    expect(getOwnedCourseMock).not.toHaveBeenCalled();
    expect(noteUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: null }),
      })
    );
  });

  it('returns 400 when a new PDF is incomplete (missing token)', async () => {
    authOk();
    const pdfUrl =
      '/api/notes/files/file-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf';

    const res = await PATCH(
      patchRequest({
        pdfName: 'lecture.pdf',
        pdfUrl,
        // pdfToken omitted
      }),
      { params: { noteId: NOTE_ID } }
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'Uploaded PDF is incomplete. Please upload it again.',
    });
    expect(finalizeNotePdfUploadMock).not.toHaveBeenCalled();
    expect(noteUpdateMock).not.toHaveBeenCalled();
  });

  it('finalizes a new PDF upload, updates the note, and deletes the previous PDF', async () => {
    authOk();
    const oldPdfUrl =
      '/api/notes/files/file-00000000-0000-0000-0000-000000000000.pdf';
    const newPdfUrl =
      '/api/notes/files/file-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf';
    const pdfToken = 'a'.repeat(64);

    getOwnedNoteMock.mockResolvedValue({
      ...existingNote,
      pdfName: 'old.pdf',
      pdfUrl: oldPdfUrl,
    } as never);
    finalizeNotePdfUploadMock.mockResolvedValue({ pdfUrl: newPdfUrl });
    noteUpdateMock.mockResolvedValue(
      mockUpdatedNote({ pdfName: 'lecture.pdf', pdfUrl: newPdfUrl }) as never
    );

    const res = await PATCH(
      patchRequest({
        pdfName: 'lecture.pdf',
        pdfUrl: newPdfUrl,
        pdfToken,
      }),
      { params: { noteId: NOTE_ID } }
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      pdfName: 'lecture.pdf',
      pdfUrl: newPdfUrl,
    });
    expect(finalizeNotePdfUploadMock).toHaveBeenCalledWith({
      userId: USER_ID,
      pdfUrl: newPdfUrl,
      pdfToken,
    });
    expect(noteUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pdfName: 'lecture.pdf',
          pdfUrl: newPdfUrl,
        }),
      })
    );
    expect(deleteNotePdfMock).toHaveBeenCalledWith(oldPdfUrl);
  });

  it('returns 400 when PDF finalization fails', async () => {
    authOk();
    const pdfUrl =
      '/api/notes/files/file-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf';
    const pdfToken = 'b'.repeat(64);
    finalizeNotePdfUploadMock.mockRejectedValue(
      new Error('Invalid PDF upload token')
    );

    const res = await PATCH(
      patchRequest({
        pdfName: 'lecture.pdf',
        pdfUrl,
        pdfToken,
      }),
      { params: { noteId: NOTE_ID } }
    );
    const { status, body } = await readJson(res);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Invalid PDF upload token' });
    expect(noteUpdateMock).not.toHaveBeenCalled();
    expect(deleteNotePdfMock).not.toHaveBeenCalled();
  });

  it('clears PDF fields when pdfUrl is null and deletes the old file', async () => {
    authOk();
    const oldPdfUrl =
      '/api/notes/files/file-11111111-1111-1111-1111-111111111111.pdf';
    getOwnedNoteMock.mockResolvedValue({
      ...existingNote,
      pdfName: 'old.pdf',
      pdfUrl: oldPdfUrl,
    } as never);
    noteUpdateMock.mockResolvedValue(
      mockUpdatedNote({ pdfName: null, pdfUrl: null }) as never
    );

    const res = await PATCH(patchRequest({ pdfName: null, pdfUrl: null }), {
      params: { noteId: NOTE_ID },
    });
    const { status, body } = await readJson(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ pdfName: null, pdfUrl: null });
    expect(finalizeNotePdfUploadMock).not.toHaveBeenCalled();
    expect(noteUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pdfName: null,
          pdfUrl: null,
        }),
      })
    );
    expect(deleteNotePdfMock).toHaveBeenCalledWith(oldPdfUrl);
  });

  it('propagates unexpected database errors from prisma.note.update', async () => {
    authOk();
    noteUpdateMock.mockRejectedValue(new Error('db connection lost'));

    await expect(
      PATCH(patchRequest({ title: 'Still fine' }), {
        params: { noteId: NOTE_ID },
      })
    ).rejects.toThrow('db connection lost');
  });
});
