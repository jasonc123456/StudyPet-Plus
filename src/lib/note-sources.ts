// Shared multi-note source assembly for quiz + flashcard generation.
//
// A quiz or flashcard deck can now be built from 1..N notes. This module loads
// the owned notes in selection order, concatenates their plain text under a
// shared character cap (reporting whether it had to truncate), and derives the
// shared course + a smart default title.

import type { AiAttachment } from '@/lib/ai/types';
import { hasVisibleRichText, richTextToPlainText } from '@/lib/note-rich-text';
import { readNotePdfFile, statNotePdfFile } from '@/lib/note-pdf';
import { prisma } from '@/lib/prisma';

/** Keep in step with the AI layer's own source cap. */
export const MAX_SOURCE_CHARS = 12_000;

// Attachment budget for a single generation request.
//
// The note cap alone (20) bounds nothing that matters: each note may carry a
// 10 MiB PDF, so one request could pull 200 MiB off disk and hold ~267 MiB of
// base64 on top of it before the model was even called. A handful of concurrent
// requests would then be competing for the whole heap. These two limits are
// what actually bound the memory a request can cost, and they are checked
// against file sizes before a single byte is read.
export const MAX_SOURCE_PDFS = 5;
export const MAX_SOURCE_PDF_BYTES = 25 * 1024 * 1024;

export type LoadedSourceNote = {
  id: string;
  title: string;
  courseId: string | null;
  plainText: string;
  /** Attached PDF URL, when this note carries one. */
  pdfUrl: string | null;
};

export type AssembledSource = {
  /** Owned notes in selection order. */
  notes: LoadedSourceNote[];
  /** Concatenated, capped source text ready for the AI layer. */
  sourceText: string;
  /** True when the combined text exceeded the cap and was cut. */
  truncated: boolean;
  /**
   * PDF attachments from the selected notes, read only here (at generation
   * time) and passed straight to the model.
   */
  attachments: AiAttachment[];
  /** Shared course when every note agrees, else null. */
  courseId: string | null;
  /** Course name for topic biasing, when there is a shared course. */
  topicHint: string | undefined;
};

export type AssembleResult =
  | { ok: true; value: AssembledSource }
  | { ok: false; reason: 'NOT_FOUND' | 'EMPTY_CONTENT' }
  /** Over the attachment budget. Carries the message to show the user. */
  | { ok: false; reason: 'SOURCE_LIMIT'; message: string };

/**
 * Load + assemble the source text for the given owned notes.
 * `NOT_FOUND` when any id isn't an owned note; `EMPTY_CONTENT` when none of the
 * notes carry visible text; `SOURCE_LIMIT` when the selected PDFs exceed the
 * per-request attachment budget.
 */
export async function assembleNoteSource(
  noteIds: string[],
  userId: string
): Promise<AssembleResult> {
  // Dedupe while preserving selection order.
  const orderedIds = [...new Set(noteIds)];

  const rows = await prisma.note.findMany({
    where: { id: { in: orderedIds }, userId },
    select: {
      id: true,
      title: true,
      courseId: true,
      content: true,
      pdfUrl: true,
      pdfName: true,
    },
  });
  if (rows.length !== orderedIds.length) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const notes: LoadedSourceNote[] = orderedIds.map((id) => {
    const row = byId.get(id)!;
    return {
      id: row.id,
      title: row.title,
      courseId: row.courseId,
      plainText: hasVisibleRichText(row.content)
        ? richTextToPlainText(row.content)
        : '',
      pdfUrl: row.pdfUrl,
    };
  });

  // Read attached PDFs here — the only point where a note's file reaches the
  // AI layer. Unreadable files are skipped rather than failing the whole run.
  const pdfNotes = orderedIds
    .map((id) => byId.get(id)!)
    .filter((row) => Boolean(row.pdfUrl));

  if (pdfNotes.length > MAX_SOURCE_PDFS) {
    return {
      ok: false,
      reason: 'SOURCE_LIMIT',
      message: `Select at most ${MAX_SOURCE_PDFS} notes with PDF attachments at a time.`,
    };
  }

  // Price the batch before loading any of it. Sizes come from stat, so an
  // over-budget request is refused without ever holding the files in memory —
  // which is the whole point of the budget.
  let budgetedBytes = 0;
  for (const row of pdfNotes) {
    try {
      const { size } = await statNotePdfFile(row.pdfUrl!);
      budgetedBytes += size;
    } catch (error) {
      // Unreadable here means unreadable below too; it contributes nothing.
      console.error('[note-sources] failed to stat note PDF', row.id, error);
    }
  }

  if (budgetedBytes > MAX_SOURCE_PDF_BYTES) {
    const limitMb = Math.floor(MAX_SOURCE_PDF_BYTES / (1024 * 1024));
    return {
      ok: false,
      reason: 'SOURCE_LIMIT',
      message: `The selected PDFs total more than ${limitMb} MB. Generate from fewer notes at a time.`,
    };
  }

  const attachments: AiAttachment[] = [];
  for (const row of pdfNotes) {
    try {
      // One file in flight at a time: the raw Buffer goes out of scope as soon
      // as it is encoded, so peak memory is the base64 set plus one file, not
      // both copies of everything.
      const { bytes } = await readNotePdfFile(row.pdfUrl!);
      attachments.push({
        filename: row.pdfName ?? 'attachment.pdf',
        mimeType: 'application/pdf',
        base64: bytes.toString('base64'),
      });
    } catch (error) {
      console.error('[note-sources] failed to read note PDF', row.id, error);
    }
  }

  const hasText = notes.some((note) => note.plainText.trim().length > 0);
  if (!hasText && attachments.length === 0) {
    return { ok: false, reason: 'EMPTY_CONTENT' };
  }

  // Concatenate note blocks under the cap. With several notes we prefix each
  // block with its title so the model sees the boundaries.
  const multi = notes.filter((n) => n.plainText.trim()).length > 1;
  const parts: string[] = [];
  let used = 0;
  let truncated = false;

  for (const note of notes) {
    const text = note.plainText.trim();
    if (!text) continue;

    const block = multi ? `# ${note.title}\n${text}` : text;
    const remaining = MAX_SOURCE_CHARS - used;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    if (block.length > remaining) {
      parts.push(block.slice(0, remaining));
      truncated = true;
      break;
    }
    parts.push(block);
    used += block.length + 2; // account for the join separator
  }

  const sourceText = parts.join('\n\n');

  const courseIds = new Set(
    notes.map((note) => note.courseId).filter((id): id is string => Boolean(id))
  );
  const courseId = courseIds.size === 1 ? [...courseIds][0]! : null;

  let topicHint: string | undefined;
  if (courseId) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
      select: { name: true },
    });
    topicHint = course?.name ?? undefined;
  }

  return {
    ok: true,
    value: { notes, sourceText, truncated, attachments, courseId, topicHint },
  };
}

/**
 * Safety valve on prompt size only — every topic a course has is sent back to
 * the model, and a course realistically never approaches this many.
 */
export const MAX_EXISTING_TOPICS = 200;

/**
 * Topic tags already used by this course's flashcards and quiz questions, most
 * recent first. Fed back into the generation prompt so a new deck/quiz reuses
 * the course's existing topic names instead of inventing a parallel set.
 * Returns [] for uncategorized sources (no shared course).
 */
export async function listCourseTopics(
  courseId: string | null,
  userId: string
): Promise<string[]> {
  if (!courseId) return [];

  const [cardTopics, questionTopics] = await Promise.all([
    prisma.flashcard.findMany({
      where: { courseId, userId },
      select: { topic: true },
      distinct: ['topic'],
      orderBy: { createdAt: 'desc' },
      take: MAX_EXISTING_TOPICS,
    }),
    prisma.quizQuestion.findMany({
      where: { userId, quiz: { courseId } },
      select: { topic: true },
      distinct: ['topic'],
      orderBy: { createdAt: 'desc' },
      take: MAX_EXISTING_TOPICS,
    }),
  ]);

  // Case-insensitive dedupe, keeping the most recent spelling of each topic.
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const { topic } of [...cardTopics, ...questionTopics]) {
    const trimmed = topic.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(trimmed);
    if (topics.length >= MAX_EXISTING_TOPICS) break;
  }
  return topics;
}

/**
 * Smart default title for a generated quiz/deck: an explicit title wins,
 * otherwise the single note's title, otherwise "First note + N more".
 */
export function defaultEntityTitle(
  notes: Array<{ title: string }>,
  explicit?: string
): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed.slice(0, 120);
  if (notes.length === 0) return 'Untitled';
  if (notes.length === 1) return notes[0]!.title.slice(0, 120);
  return `${notes[0]!.title} + ${notes.length - 1} more`.slice(0, 120);
}
