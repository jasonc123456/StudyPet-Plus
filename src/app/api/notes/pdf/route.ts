import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { saveNotePdfUpload } from '@/lib/note-pdf';
import { rateLimit } from '@/lib/rate-limit';

/** Enough for a heavy note-taking session, far short of filling a volume. */
const UPLOAD_LIMIT = 20;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  // Keyed by account, not address: the storage budget this protects is per-user,
  // and the caller is authenticated so there is a better identity than an IP.
  const limit = rateLimit(
    `note-pdf:${authResult.user.id}`,
    UPLOAD_LIMIT,
    UPLOAD_WINDOW_MS
  );
  if (!limit.ok) {
    return jsonError('Too many uploads. Try again shortly.', 429, {
      'Retry-After': String(limit.retryAfterSeconds),
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid form data', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError('Choose a PDF file to upload', 400);
  }

  try {
    const saved = await saveNotePdfUpload(file, authResult.user.id);
    return jsonOk(saved, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload PDF';
    return jsonError(message, 400);
  }
}
