// One-time backfill for Note.pdfBytes.
//
// The column was added after attachments already existed, and the true sizes
// live on the filesystem where SQL cannot reach them. This stats each attached
// file and records its size.
//
// Safe to re-run: it only touches rows where pdfBytes is still null, and a file
// that has gone missing is reported and left null (unknown), never written as
// zero — zero would claim the account uses no storage, which is a different
// and wrong statement.
//
// Usage (inside the app container, as the dev user):
//   node scripts/backfill-note-pdf-bytes.mjs

import { stat } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOTE_PDF_DIR =
  process.env.NOTE_PDF_STORAGE_DIR ??
  path.join(process.cwd(), 'uploads', 'note-pdfs');
const ROUTE_PREFIX = '/api/notes/files/';

function storedPathFor(pdfUrl) {
  if (!pdfUrl?.startsWith(ROUTE_PREFIX)) return null;

  const fileId = pdfUrl.slice(ROUTE_PREFIX.length);
  // Same guard the app uses: the id is a single path segment, never a traversal.
  if (!fileId || fileId.includes('/') || fileId.includes('..')) return null;

  // The id already carries its extension (files are stored as
  // "file-<uuid>.pdf"), so this joins it as-is — appending ".pdf" here looks
  // right and silently misses every file.
  return path.join(NOTE_PDF_DIR, fileId);
}

const notes = await prisma.note.findMany({
  where: { pdfUrl: { not: null }, pdfBytes: null },
  select: { id: true, pdfUrl: true, pdfName: true },
});

console.log(`Found ${notes.length} attachment(s) with no recorded size.`);

let updated = 0;
let missing = 0;

for (const note of notes) {
  const filePath = storedPathFor(note.pdfUrl);

  if (!filePath) {
    console.warn(`  ? ${note.id}: unrecognised pdfUrl (${note.pdfUrl})`);
    missing += 1;
    continue;
  }

  try {
    const { size } = await stat(filePath);
    await prisma.note.update({
      where: { id: note.id },
      data: { pdfBytes: size },
    });
    console.log(`  ✓ ${note.id}: ${size} bytes (${note.pdfName ?? 'unnamed'})`);
    updated += 1;
  } catch {
    console.warn(`  ! ${note.id}: file missing on disk, left unknown`);
    missing += 1;
  }
}

console.log(`\nDone. ${updated} recorded, ${missing} left unknown.`);
await prisma.$disconnect();
