// Flashcard generation + persistence (US-3.3).
//
// Loads a Note the caller owns, asks the AI layer for topic-tagged cards, then
// bulk-inserts them. Append-only: regenerating the same note adds more rows.

import { generateFlashcards } from '@/lib/ai';
import {
  flashcardResponseSchema,
  type AiProviderName,
} from '@/lib/ai/types';
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
