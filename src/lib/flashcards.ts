// Flashcard generation + persistence (US-3.3).
//
// Loads a Note the caller owns, asks the AI layer for topic-tagged cards, then
// bulk-inserts them. Append-only: regenerating the same note adds more rows.

import { generateFlashcards } from '@/lib/ai';
import { flashcardResponseSchema, type AiProviderName } from '@/lib/ai/types';
import { getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import type { Flashcard as FlashcardRow } from '@prisma/client';

export class FlashcardServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'EMPTY_CONTENT',
    message: string
  ) {
    super(message);
    this.name = 'FlashcardServiceError';
  }
}

export type GenerateAndSaveFlashcardsInput = {
  noteId: string;
  userId: string;
  count?: number;
};

export type GenerateAndSaveFlashcardsResult = {
  flashcards: FlashcardRow[];
  provider: AiProviderName;
};

/**
 * Generate flashcards from a note's content and persist them.
 * Throws FlashcardServiceError for ownership / empty-content failures;
 * rethrows AiProviderError (and other errors) for the route to map.
 */
export async function generateAndSaveFlashcards(
  input: GenerateAndSaveFlashcardsInput
): Promise<GenerateAndSaveFlashcardsResult> {
  const note = await getOwnedNote(input.noteId, input.userId);
  if (!note) {
    throw new FlashcardServiceError('NOT_FOUND', 'Note not found');
  }

  if (!note.content.trim()) {
    throw new FlashcardServiceError(
      'EMPTY_CONTENT',
      'Note has no content to generate flashcards from'
    );
  }

  let topicHint: string | undefined;
  if (note.courseId) {
    const course = await prisma.course.findFirst({
      where: { id: note.courseId, userId: input.userId },
      select: { name: true },
    });
    topicHint = course?.name;
  }

  const { items, provider } = await generateFlashcards({
    sourceText: note.content,
    count: input.count,
    topicHint,
  });

  // Defense in depth — generateFlashcards already validates, but re-check
  // before writing so a future AI change can't persist malformed rows.
  const parsed = flashcardResponseSchema.safeParse({ cards: items });
  if (!parsed.success) {
    throw new Error('AI returned flashcards that failed schema validation');
  }

  const cards = parsed.data.cards;
  const createdAt = new Date();

  await prisma.flashcard.createMany({
    data: cards.map((card) => ({
      userId: input.userId,
      noteId: note.id,
      courseId: note.courseId,
      topic: card.topic,
      front: card.front,
      back: card.back,
      createdAt,
    })),
  });

  // createMany does not return rows; fetch the batch we just wrote.
  const flashcards = await prisma.flashcard.findMany({
    where: {
      noteId: note.id,
      userId: input.userId,
      createdAt,
    },
    orderBy: { id: 'asc' },
  });

  return { flashcards, provider };
}

/** All flashcards for a note owned by the user, newest first. */
export async function listFlashcardsForNote(
  noteId: string,
  userId: string
): Promise<FlashcardRow[]> {
  const note = await getOwnedNote(noteId, userId);
  if (!note) {
    return [];
  }

  return prisma.flashcard.findMany({
    where: { noteId, userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
}

function titleFromPastedContent(content: string, explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed.slice(0, 200);

  const firstLine =
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? 'Flashcard notes';

  return firstLine.slice(0, 200);
}

/** Create a Note from pasted text, then generate flashcards for it. */
export async function createNoteAndGenerateFlashcards(input: {
  userId: string;
  content: string;
  title?: string;
  count?: number;
}): Promise<GenerateAndSaveFlashcardsResult & { noteId: string }> {
  const content = input.content.trim();
  if (!content) {
    throw new FlashcardServiceError(
      'EMPTY_CONTENT',
      'Paste some notes before generating flashcards'
    );
  }

  const note = await prisma.note.create({
    data: {
      userId: input.userId,
      title: titleFromPastedContent(content, input.title),
      content,
    },
  });

  const result = await generateAndSaveFlashcards({
    noteId: note.id,
    userId: input.userId,
    count: input.count,
  });

  return { ...result, noteId: note.id };
}

export async function createOwnedFlashcard(input: {
  userId: string;
  noteId: string;
  topic: string;
  front: string;
  back: string;
}): Promise<FlashcardRow> {
  const note = await getOwnedNote(input.noteId, input.userId);
  if (!note) {
    throw new FlashcardServiceError('NOT_FOUND', 'Note not found');
  }

  return prisma.flashcard.create({
    data: {
      userId: input.userId,
      noteId: note.id,
      courseId: note.courseId,
      topic: input.topic,
      front: input.front,
      back: input.back,
    },
  });
}

export async function updateOwnedFlashcard(input: {
  userId: string;
  id: string;
  topic: string;
  front: string;
  back: string;
}): Promise<FlashcardRow> {
  const existing = await prisma.flashcard.findFirst({
    where: { id: input.id, userId: input.userId },
  });
  if (!existing) {
    throw new FlashcardServiceError('NOT_FOUND', 'Flashcard not found');
  }

  return prisma.flashcard.update({
    where: { id: existing.id },
    data: {
      topic: input.topic,
      front: input.front,
      back: input.back,
    },
  });
}

export async function deleteOwnedFlashcard(
  id: string,
  userId: string
): Promise<void> {
  const existing = await prisma.flashcard.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    throw new FlashcardServiceError('NOT_FOUND', 'Flashcard not found');
  }

  await prisma.flashcard.delete({ where: { id: existing.id } });
}

/** Deletes all flashcards for a note; keeps the Note row. */
export async function deleteOwnedFlashcardSet(
  noteId: string,
  userId: string
): Promise<number> {
  const note = await getOwnedNote(noteId, userId);
  if (!note) {
    throw new FlashcardServiceError('NOT_FOUND', 'Note not found');
  }

  const result = await prisma.flashcard.deleteMany({
    where: { noteId, userId },
  });
  return result.count;
}
