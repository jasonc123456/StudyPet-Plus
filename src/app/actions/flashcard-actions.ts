'use server';

import { revalidatePath } from 'next/cache';

import { requireActionUser } from '@/lib/action-auth';
import { AiBudgetError } from '@/lib/ai/entitlement';
import { AiProviderError } from '@/lib/ai/provider';
import {
  FlashcardServiceError,
  createNoteAndGenerateFlashcards,
  createOwnedFlashcard,
  deleteOwnedFlashcard,
  deleteOwnedFlashcardSet,
  generateAndSaveFlashcards,
  updateOwnedFlashcard,
} from '@/lib/flashcards';
import { prisma } from '@/lib/prisma';
import {
  createFlashcardSchema,
  createFlashcardsFromPasteSchema,
  updateFlashcardSchema,
  zodFirstError,
} from '@/lib/validators';
import type { Flashcard as FlashcardRow } from '@prisma/client';

export type FlashcardActionErrorCode =
  | 'UNAUTHORIZED'
  | 'MFA_REQUIRED'
  | 'NOT_FOUND'
  | 'EMPTY_CONTENT'
  | 'LIMIT_REACHED'
  | 'AI_ERROR'
  | 'VALIDATION'
  | 'UNKNOWN';

export type GenerateFlashcardsActionState =
  | {
      ok: true;
      flashcards: FlashcardRow[];
      generatedCount: number;
      provider: string;
      noteId?: string;
    }
  | {
      ok: false;
      error: string;
      code?: FlashcardActionErrorCode;
    };

export type FlashcardMutationState =
  | { ok: true; flashcard?: FlashcardRow; deletedCount?: number }
  | { ok: false; error: string; code?: FlashcardActionErrorCode };

function revalidateFlashcardPaths(id?: string | null) {
  revalidatePath('/dashboard/flashcards');
  revalidatePath('/flashcards');
  if (id) {
    // id may be a note id (note editor) or a deck id (study route); revalidate
    // both shapes — a non-matching path is a harmless no-op.
    revalidatePath(`/dashboard/notes/${id}/edit`);
    revalidatePath(`/dashboard/flashcards/study/${id}`);
  }
}

function mapServiceError(error: unknown): GenerateFlashcardsActionState {
  if (error instanceof FlashcardServiceError) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
    };
  }

  if (error instanceof AiBudgetError) {
    return { ok: false, error: error.message, code: 'LIMIT_REACHED' };
  }

  if (error instanceof AiProviderError) {
    console.error('[ai] flashcard provider error', error.message.slice(0, 300));
    const notConfigured =
      /AI generation is not configured|Set GEMINI_API_KEY/i.test(error.message);
    return {
      ok: false,
      error: notConfigured
        ? 'AI generation is not configured. Set GEMINI_API_KEY on the server.'
        : 'Flashcard generation failed. The AI provider timed out or returned an invalid response. Please try again.',
      code: 'AI_ERROR',
    };
  }

  console.error('flashcard action', error);
  return {
    ok: false,
    error: 'Failed to generate flashcards. Please try again.',
    code: 'UNKNOWN',
  };
}

/**
 * Server action for US-3.3 — wraps generateAndSaveFlashcards for the note UI.
 */
export async function generateFlashcardsAction(
  noteId: string,
  count?: number
): Promise<GenerateFlashcardsActionState> {
  const authResult = await requireActionUser();
  if (!authResult.ok) return authResult;

  try {
    const result = await generateAndSaveFlashcards({
      noteIds: [noteId],
      userId: authResult.userId,
      count,
    });

    revalidateFlashcardPaths(noteId);

    return {
      ok: true,
      flashcards: result.flashcards,
      generatedCount: result.generatedCount,
      provider: result.provider,
      noteId,
    };
  } catch (error) {
    return mapServiceError(error);
  }
}

/** Paste notes → create Note → generate flashcards. */
export async function createFlashcardsFromPasteAction(input: {
  title?: string;
  content: string;
  count?: number;
}): Promise<GenerateFlashcardsActionState> {
  const authResult = await requireActionUser();
  if (!authResult.ok) return authResult;

  const parsed = createFlashcardsFromPasteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: zodFirstError(parsed.error),
      code: 'VALIDATION',
    };
  }

  try {
    const result = await createNoteAndGenerateFlashcards({
      userId: authResult.userId,
      content: parsed.data.content,
      title: parsed.data.title,
      count: parsed.data.count,
    });

    revalidateFlashcardPaths(result.noteId);
    revalidatePath('/dashboard/notes');

    return {
      ok: true,
      flashcards: result.flashcards,
      generatedCount: result.generatedCount,
      provider: result.provider,
      noteId: result.noteId,
    };
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function createFlashcardAction(input: {
  setId: string;
  topic: string;
  front: string;
  back: string;
}): Promise<FlashcardMutationState> {
  const authResult = await requireActionUser();
  if (!authResult.ok) return authResult;

  const parsed = createFlashcardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: zodFirstError(parsed.error),
      code: 'VALIDATION',
    };
  }

  try {
    const flashcard = await createOwnedFlashcard({
      userId: authResult.userId,
      ...parsed.data,
    });
    revalidateFlashcardPaths(parsed.data.setId);
    return { ok: true, flashcard };
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return { ok: false, error: error.message, code: error.code };
    }
    console.error('createFlashcardAction', error);
    return { ok: false, error: 'Failed to create flashcard.', code: 'UNKNOWN' };
  }
}

export async function updateFlashcardAction(input: {
  id: string;
  topic: string;
  front: string;
  back: string;
}): Promise<FlashcardMutationState> {
  const authResult = await requireActionUser();
  if (!authResult.ok) return authResult;

  const parsed = updateFlashcardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: zodFirstError(parsed.error),
      code: 'VALIDATION',
    };
  }

  try {
    const flashcard = await updateOwnedFlashcard({
      userId: authResult.userId,
      ...parsed.data,
    });
    revalidateFlashcardPaths(flashcard.noteId);
    return { ok: true, flashcard };
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return { ok: false, error: error.message, code: error.code };
    }
    console.error('updateFlashcardAction', error);
    return { ok: false, error: 'Failed to update flashcard.', code: 'UNKNOWN' };
  }
}

export async function deleteFlashcardAction(
  id: string
): Promise<FlashcardMutationState> {
  const authResult = await requireActionUser();
  if (!authResult.ok) return authResult;

  if (!id || typeof id !== 'string') {
    return { ok: false, error: 'Invalid flashcard.', code: 'VALIDATION' };
  }

  try {
    const existing = await prisma.flashcard.findFirst({
      where: { id, userId: authResult.userId },
      select: { noteId: true },
    });
    await deleteOwnedFlashcard(id, authResult.userId);
    revalidateFlashcardPaths(existing?.noteId);
    return { ok: true, deletedCount: 1 };
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return { ok: false, error: error.message, code: error.code };
    }
    console.error('deleteFlashcardAction', error);
    return { ok: false, error: 'Failed to delete flashcard.', code: 'UNKNOWN' };
  }
}

export async function deleteFlashcardSetAction(
  setId: string
): Promise<FlashcardMutationState> {
  const authResult = await requireActionUser();
  if (!authResult.ok) return authResult;

  if (!setId || typeof setId !== 'string') {
    return { ok: false, error: 'Invalid deck.', code: 'VALIDATION' };
  }

  try {
    const deletedCount = await deleteOwnedFlashcardSet(
      setId,
      authResult.userId
    );
    revalidateFlashcardPaths(setId);
    return { ok: true, deletedCount };
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return { ok: false, error: error.message, code: error.code };
    }
    console.error('deleteFlashcardSetAction', error);
    return {
      ok: false,
      error: 'Failed to delete flashcard set.',
      code: 'UNKNOWN',
    };
  }
}
