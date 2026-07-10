import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { saveNotePdf } from '@/lib/note-pdf';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

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
    const saved = await saveNotePdf(file);
    return jsonOk(saved, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload PDF';
    return jsonError(message, 400);
  }
}
