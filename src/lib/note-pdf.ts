import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const NOTE_PDF_DIR = path.join(process.cwd(), 'public', 'note-pdfs');
const NOTE_PDF_PUBLIC_PREFIX = '/note-pdfs/';
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function sanitizePdfBaseName(filename: string) {
  const parsed = path.parse(filename);
  const safeBase = parsed.name
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return safeBase || 'note';
}

export async function saveNotePdf(file: File) {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed');
  }

  if (file.size <= 0) {
    throw new Error('PDF file is empty');
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 10 MB or smaller');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${sanitizePdfBaseName(file.name)}-${randomUUID()}.pdf`;

  await mkdir(NOTE_PDF_DIR, { recursive: true });
  await writeFile(path.join(NOTE_PDF_DIR, filename), bytes);

  return {
    pdfName: file.name,
    pdfUrl: `${NOTE_PDF_PUBLIC_PREFIX}${filename}`,
  };
}

export async function deleteNotePdf(pdfUrl: string | null | undefined) {
  if (!pdfUrl || !pdfUrl.startsWith(NOTE_PDF_PUBLIC_PREFIX)) {
    return;
  }

  const filename = pdfUrl.slice(NOTE_PDF_PUBLIC_PREFIX.length);
  if (!filename) {
    return;
  }

  try {
    await unlink(path.join(NOTE_PDF_DIR, filename));
  } catch {
    // Best-effort cleanup only. The DB mutation should not fail because a file
    // was already removed or never written locally.
  }
}
