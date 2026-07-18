// Flashcard generation + persistence (US-3.3).
//
// Asks the AI layer for topic-tagged cards from 1..N owned notes, then persists
// them as a new FlashcardSet (deck) with its source-note links.

import { dedupeFlashcards, generateFlashcards } from '@/lib/ai';
import {
  flashcardResponseSchema,
  type AiProgressCallback,
  type AiProviderName,
} from '@/lib/ai/types';
import { assembleNoteSource, defaultEntityTitle } from '@/lib/note-sources';
import { getOwnedNote } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import type {
  Flashcard as FlashcardRow,
  FlashcardSet as FlashcardSetRow,
} from '@prisma/client';

export class FlashcardServiceError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'EMPTY_CONTENT' | 'LIMIT_REACHED',
    message: string
  ) {
    super(message);
    this.name = 'FlashcardServiceError';
  }
}

/** A single generated deck holds at most this many cards. */
export const MAX_FLASHCARDS_PER_SET = 100;

export type GenerateAndSaveFlashcardsInput = {
  /** One or more owned notes the deck is built from. */
  noteIds: string[];
  userId: string;
  /** Optional user-supplied title; a smart default is derived otherwise. */
  title?: string;
  count?: number;
  /** Optional live progress callback forwarded to the AI layer. */
  onProgress?: AiProgressCallback;
};

export type GenerateAndSaveFlashcardsResult = {
  /** The deck that was created. */
  set: FlashcardSetRow;
  /** The cards inserted into the deck. */
  flashcards: FlashcardRow[];
  /** How many cards were inserted. */
  generatedCount: number;
  provider: AiProviderName;
  /** True when the combined source text was truncated to the cap. */
  truncated: boolean;
};

/**
 * Generate flashcards from 1..N owned notes and persist them as a new deck.
 * Throws FlashcardServiceError for ownership / empty-content failures;
 * rethrows AiProviderError (and other errors) for the route to map.
 */
export async function generateAndSaveFlashcards(
  input: GenerateAndSaveFlashcardsInput
): Promise<GenerateAndSaveFlashcardsResult> {
  const assembled = await assembleNoteSource(input.noteIds, input.userId);
  if (!assembled.ok) {
    if (assembled.reason === 'NOT_FOUND') {
      throw new FlashcardServiceError('NOT_FOUND', 'Note not found');
    }
    throw new FlashcardServiceError(
      'EMPTY_CONTENT',
      'Selected notes have no content to generate flashcards from'
    );
  }

  const { notes, sourceText, truncated, courseId, topicHint } = assembled.value;

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

  const cards = dedupeFlashcards(parsed.data.cards).slice(
    0,
    MAX_FLASHCARDS_PER_SET
  );

  if (cards.length === 0) {
    throw new FlashcardServiceError(
      'EMPTY_CONTENT',
      'No flashcards could be generated from the selected notes'
    );
  }

  const title = defaultEntityTitle(notes, input.title);
  // Keep the legacy single-note link populated when there's exactly one note.
  const singleNoteId = notes.length === 1 ? notes[0]!.id : null;

  const set = await prisma.flashcardSet.create({
    data: {
      userId: input.userId,
      title,
      courseId,
      sourceNotes: {
        create: notes.map((note) => ({ noteId: note.id })),
      },
      cards: {
        create: cards.map((card) => ({
          userId: input.userId,
          noteId: singleNoteId,
          courseId,
          topic: card.topic,
          front: card.front,
          back: card.back,
        })),
      },
    },
  });

  const flashcards = await prisma.flashcard.findMany({
    where: { setId: set.id, userId: input.userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return {
    set,
    flashcards,
    generatedCount: flashcards.length,
    provider,
    truncated,
  };
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
    noteIds: [note.id],
    userId: input.userId,
    title: input.title,
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
