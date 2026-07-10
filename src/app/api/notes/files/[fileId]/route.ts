import { NextResponse } from 'next/server';

import { jsonError, requireUser } from '@/lib/api-response';
import { readNotePdfFile } from '@/lib/note-pdf';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { fileId: string };
};

function encodeDownloadFilename(filename: string) {
  return encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const pdfUrl = `/api/notes/files/${params.fileId}`;

  const note = await prisma.note.findFirst({
    where: {
      userId: authResult.user.id,
      pdfUrl,
    },
    select: {
      pdfName: true,
      pdfUrl: true,
    },
  });

  if (!note?.pdfUrl || !note.pdfName) {
    return jsonError('PDF not found', 404);
  }

  try {
    const { bytes } = await readNotePdfFile(note.pdfUrl);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename="${note.pdfName.replace(/"/g, '')}"; filename*=UTF-8''${encodeDownloadFilename(note.pdfName)}`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none';",
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch {
    return jsonError('PDF not found', 404);
  }
}
