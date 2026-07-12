'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { AiProviderError } from '@/lib/ai/provider';
import {
  FlashcardServiceError,
  generateAndSaveFlashcards,
} from '@/lib/flashcards';
import type { Flashcard as FlashcardRow } from '@prisma/client';

export type GenerateFlashcardsActionState =
  | {
      ok: true;
      flashcards: FlashcardRow[];
      provider: string;
    }
  | {
      ok: false;
      error: string;
      code?:
        'UNAUTHORIZED' | 'NOT_FOUND' | 'EMPTY_CONTENT' | 'AI_ERROR' | 'UNKNOWN';
    };

/**
 * Server action for US-3.3 — wraps generateAndSaveFlashcards for the note UI.
 */
export async function generateFlashcardsAction(
  noteId: string,
  count?: number
): Promise<GenerateFlashcardsActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      error: 'You must be signed in to generate flashcards.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const result = await generateAndSaveFlashcards({
      noteId,
      userId: session.user.id,
      count,
    });

    revalidatePath(`/dashboard/notes/${noteId}/edit`);
    revalidatePath('/dashboard/flashcards');
    revalidatePath('/flashcards');

    return {
      ok: true,
      flashcards: result.flashcards,
      provider: result.provider,
    };
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
      };
    }

    if (error instanceof AiProviderError) {
      return {
        ok: false,
        error:
          'Flashcard generation failed. The AI provider timed out or returned an invalid response. Please try again.',
        code: 'AI_ERROR',
      };
    }

    console.error('generateFlashcardsAction', error);
    return {
      ok: false,
      error: 'Failed to generate flashcards. Please try again.',
      code: 'UNKNOWN',
    };
  }
}
