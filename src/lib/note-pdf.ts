import { createHmac, randomUUID } from 'crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import path from 'path';

const NOTE_PDF_DIR = path.join(process.cwd(), '.uploads', 'note-pdfs');
const NOTE_PDF_TMP_DIR = path.join(NOTE_PDF_DIR, 'tmp');
const NOTE_PDF_FILE_PREFIX = 'file-';
const NOTE_PDF_TMP_PREFIX = 'upload-';
const NOTE_PDF_ROUTE_PREFIX = '/api/notes/files/';
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC_HEADER = '%PDF-';

function getPdfSigningSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-secret';
}

function sanitizePdfDisplayName(filename: string) {
  const parsed = path.parse(filename);
  const extension = parsed.ext.toLowerCase() === '.pdf' ? '.pdf' : '';
  const safeBase = parsed.name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  return `${safeBase || 'note-attachment'}${extension || '.pdf'}`;
}

function buildPdfToken(userId: string, uploadId: string) {
  return createHmac('sha256', getPdfSigningSecret())
    .update(`${userId}:${uploadId}`)
    .digest('hex');
}

function extractPdfFileId(pdfUrl: string) {
  if (!pdfUrl.startsWith(NOTE_PDF_ROUTE_PREFIX)) {
    return null;
  }

  const fileId = pdfUrl.slice(NOTE_PDF_ROUTE_PREFIX.length);
  if (!/^file-[a-f0-9-]+\.pdf$/i.test(fileId)) {
    return null;
  }

  return fileId;
}

function getTmpUploadPath(uploadId: string) {
  return path.join(NOTE_PDF_TMP_DIR, uploadId);
}

function getStoredFilePath(fileId: string) {
  return path.join(NOTE_PDF_DIR, fileId);
}

async function ensurePdfDirectories() {
  await mkdir(NOTE_PDF_TMP_DIR, { recursive: true });
}

function assertPdfContent(file: File, bytes: Buffer) {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed');
  }

  if (file.size <= 0) {
    throw new Error('PDF file is empty');
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF must be 10 MB or smaller');
  }

  if (
    !bytes
      .subarray(0, PDF_MAGIC_HEADER.length)
      .equals(Buffer.from(PDF_MAGIC_HEADER))
  ) {
    throw new Error('Uploaded file is not a valid PDF');
  }
}

export async function saveNotePdfUpload(file: File, userId: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  assertPdfContent(file, bytes);

  const uploadId = `${NOTE_PDF_TMP_PREFIX}${randomUUID()}.pdf`;

  await ensurePdfDirectories();
  await writeFile(getTmpUploadPath(uploadId), bytes, { flag: 'wx' });

  return {
    pdfName: sanitizePdfDisplayName(file.name),
    pdfUrl: `${NOTE_PDF_ROUTE_PREFIX}${uploadId.replace(
      NOTE_PDF_TMP_PREFIX,
      NOTE_PDF_FILE_PREFIX
    )}`,
    pdfToken: buildPdfToken(userId, uploadId),
  };
}

export async function finalizeNotePdfUpload({
  userId,
  pdfUrl,
  pdfToken,
}: {
  userId: string;
  pdfUrl: string;
  pdfToken: string;
}) {
  const fileId = extractPdfFileId(pdfUrl);
  if (!fileId) {
    throw new Error('Invalid PDF reference');
  }

  const uploadId = fileId.replace(NOTE_PDF_FILE_PREFIX, NOTE_PDF_TMP_PREFIX);
  const expectedToken = buildPdfToken(userId, uploadId);
  if (pdfToken !== expectedToken) {
    throw new Error('Invalid PDF upload token');
  }

  await ensurePdfDirectories();

  const sourcePath = getTmpUploadPath(uploadId);
  const destinationPath = getStoredFilePath(fileId);

  try {
    await rename(sourcePath, destinationPath);
  } catch {
    try {
      await readFile(destinationPath);
    } catch {
      throw new Error('Uploaded PDF could not be finalized');
    }
  }

  return {
    pdfUrl: `${NOTE_PDF_ROUTE_PREFIX}${fileId}`,
  };
}

export async function readNotePdfFile(pdfUrl: string) {
  const fileId = extractPdfFileId(pdfUrl);
  if (!fileId) {
    throw new Error('Invalid PDF reference');
  }

  return {
    fileId,
    bytes: await readFile(getStoredFilePath(fileId)),
  };
}

export async function deleteNotePdf(pdfUrl: string | null | undefined) {
  if (!pdfUrl) {
    return;
  }

  const fileId = extractPdfFileId(pdfUrl);
  if (!fileId) {
    return;
  }

  const uploadId = fileId.replace(NOTE_PDF_FILE_PREFIX, NOTE_PDF_TMP_PREFIX);

  await Promise.allSettled([
    unlink(getStoredFilePath(fileId)),
    unlink(getTmpUploadPath(uploadId)),
  ]);
}

export const notePdfSecurityMessage =
  'PDFs are stored as attachments only and are not automatically parsed or sent to AI tools.';
