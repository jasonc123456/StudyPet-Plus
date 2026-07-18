// Flashcard generation + persistence (US-3.3).
//
// Loads a Note the caller owns, asks the AI layer for topic-tagged cards, then
// bulk-inserts them. Optional replaceGenerated removes prior AI batches while
// keeping manually created singleton cards.

import { dedupeFlashcards, generateFlashcards } from '@/lib/ai';
import {
  flashcardResponseSchema,
  type AiProgressCallback,
  type AiProviderName,
} from '@/lib/ai/types';
import { hasVisibleRichText, richTextToPlainText } from '@/lib/note-rich-text';
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
  /** When true, remove prior AI-generated batches before inserting new cards. */
  replaceGenerated?: boolean;
  /** Optional live progress callback forwarded to the AI layer. */
  onProgress?: AiProgressCallback;
};

export type GenerateAndSaveFlashcardsResult = {
  /** All cards for the note after the operation (includes kept manual cards). */
  flashcards: FlashcardRow[];
  /** How many cards were inserted in this generation. */
  generatedCount: number;
  provider: AiProviderName;
};

const KNOWN_DEMO_FRONTS = new Set([
  'what is spaced repetition?',
  'why turn notes into flashcards?',
  '(demo card) how do i get real cards?',
]);

/**
 * AI createMany batches share one createdAt. Manual cards are inserted one at a
 * time and almost always have unique timestamps. Also drop known demo fronts.
 */
async function deleteAiGeneratedFlashcards(
  noteId: string,
  userId: string
): Promise<number> {
  const existing = await prisma.flashcard.findMany({
    where: { noteId, userId },
    select: { id: true, createdAt: true, front: true },
  });

  const countByTs = new Map<number, number>();
  for (const card of existing) {
    const ts = card.createdAt.getTime();
    countByTs.set(ts, (countByTs.get(ts) ?? 0) + 1);
  }

  const ids = existing
    .filter((card) => {
      const batchSize = countByTs.get(card.createdAt.getTime()) ?? 0;
      const isBatch = batchSize >= 2;
      const isDemoFront = KNOWN_DEMO_FRONTS.has(
        card.front.trim().toLowerCase()
      );
      return isBatch || isDemoFront;
    })
    .map((card) => card.id);

  if (ids.length === 0) return 0;

  const result = await prisma.flashcard.deleteMany({
    where: { id: { in: ids }, userId },
  });
  return result.count;
}

function cardKey(front: string, back: string): string {
  return `${front.trim().toLowerCase()}::${back.trim().toLowerCase()}`;
}

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

  const sourceText = richTextToPlainText(note.content);

  if (!hasVisibleRichText(note.content)) {
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
    sourceText,
    count: input.count,
    topicHint,
    onProgress: input.onProgress,
  });

  // Never persist demo material unless the caller explicitly requested demo mode
  // (AI layer only returns provider:'demo' when AI_DEMO_MODE === "true").
  if (provider === 'demo' && process.env['AI_DEMO_MODE'] !== 'true') {
    throw new Error('Refusing to persist demo flashcards while AI mode is on');
  }

  // Defense in depth — generateFlashcards already validates + dedupes.
  const parsed = flashcardResponseSchema.safeParse({ cards: items });
  if (!parsed.success) {
    throw new Error('AI returned flashcards that failed schema validation');
  }

  let cards = dedupeFlashcards(parsed.data.cards);

  if (input.replaceGenerated) {
    await deleteAiGeneratedFlashcards(note.id, input.userId);
  }

  // Skip cards that already exist on this note (manual or previous AI).
  const existing = await prisma.flashcard.findMany({
    where: { noteId: note.id, userId: input.userId },
    select: { front: true, back: true },
  });
  const existingKeys = new Set(
    existing.map((card) => cardKey(card.front, card.back))
  );
  cards = cards.filter(
    (card) => !existingKeys.has(cardKey(card.front, card.back))
  );

  if (cards.length === 0) {
    const flashcards = await prisma.flashcard.findMany({
      where: { noteId: note.id, userId: input.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return { flashcards, generatedCount: 0, provider };
  }

  // Shared timestamp marks this insert as an AI batch for later replace.
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

  const flashcards = await prisma.flashcard.findMany({
    where: { noteId: note.id, userId: input.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });

  return { flashcards, generatedCount: cards.length, provider };
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
  onProgress?: AiProgressCallback;
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
    onProgress: input.onProgress,
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
