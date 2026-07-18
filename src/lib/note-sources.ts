// Shared multi-note source assembly for quiz + flashcard generation.
//
// A quiz or flashcard deck can now be built from 1..N notes. This module loads
// the owned notes in selection order, concatenates their plain text under a
// shared character cap (reporting whether it had to truncate), and derives the
// shared course + a smart default title.

import { hasVisibleRichText, richTextToPlainText } from '@/lib/note-rich-text';
import { prisma } from '@/lib/prisma';

/** Keep in step with the AI layer's own source cap. */
export const MAX_SOURCE_CHARS = 12_000;

export type LoadedSourceNote = {
  id: string;
  title: string;
  courseId: string | null;
  plainText: string;
};

export type AssembledSource = {
  /** Owned notes in selection order. */
  notes: LoadedSourceNote[];
  /** Concatenated, capped source text ready for the AI layer. */
  sourceText: string;
  /** True when the combined text exceeded the cap and was cut. */
  truncated: boolean;
  /** Shared course when every note agrees, else null. */
  courseId: string | null;
  /** Course name for topic biasing, when there is a shared course. */
  topicHint: string | undefined;
};

export type AssembleResult =
  | { ok: true; value: AssembledSource }
  | { ok: false; reason: 'NOT_FOUND' | 'EMPTY_CONTENT' };

/**
 * Load + assemble the source text for the given owned notes.
 * `NOT_FOUND` when any id isn't an owned note; `EMPTY_CONTENT` when none of the
 * notes carry visible text.
 */
export async function assembleNoteSource(
  noteIds: string[],
  userId: string
): Promise<AssembleResult> {
  // Dedupe while preserving selection order.
  const orderedIds = [...new Set(noteIds)];

  const rows = await prisma.note.findMany({
    where: { id: { in: orderedIds }, userId },
    select: { id: true, title: true, courseId: true, content: true },
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
    };
  });

  if (!notes.some((note) => note.plainText.trim().length > 0)) {
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
    value: { notes, sourceText, truncated, courseId, topicHint },
  };
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
