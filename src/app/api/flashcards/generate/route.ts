import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { AiProviderError } from '@/lib/ai/provider';
import { streamGeneration } from '@/lib/ai/sse';
import { jsonError, requireUser } from '@/lib/api-response';
import {
  createNoteAndGenerateFlashcards,
  FlashcardServiceError,
  generateAndSaveFlashcards,
} from '@/lib/flashcards';
import {
  createFlashcardsFromPasteSchema,
  generateFlashcardsRequestSchema,
  resolveNoteIds,
  zodFirstError,
} from '@/lib/validators';

function aiErrorMessage(error: AiProviderError): string {
  const notConfigured = /not configured|GEMINI_API_KEY|LOCAL_AI/i.test(
    error.message
  );
  return notConfigured
    ? 'AI generation is not configured on the server.'
    : 'Flashcard generation failed. The AI provider timed out or returned an invalid response. Please try again.';
}

function revalidateFlashcardPaths(noteId?: string) {
  revalidatePath('/dashboard/flashcards');
  revalidatePath('/flashcards');
  if (noteId) {
    revalidatePath(`/dashboard/notes/${noteId}/edit`);
    revalidatePath(`/dashboard/flashcards/study/${noteId}`);
  }
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const userId = authResult.user.id;

  // Two modes share this endpoint: generate from existing notes (has noteId or
  // noteIds), or paste text → create a note → generate. Branch on the note
  // selection so the right validator runs and both surface a proper 400 before
  // streaming starts.
  const bodyObj = (
    typeof body === 'object' && body !== null ? body : {}
  ) as Record<string, unknown>;
  const hasNoteSelection =
    typeof bodyObj['noteId'] === 'string' || Array.isArray(bodyObj['noteIds']);

  if (hasNoteSelection) {
    const parsed = generateFlashcardsRequestSchema.safeParse(body);
    if (!parsed.success) return jsonError(zodFirstError(parsed.error), 400);
    const { title, count } = parsed.data;
    const noteIds = resolveNoteIds(parsed.data);

    return streamGeneration(async (emit) => {
      try {
        const result = await generateAndSaveFlashcards({
          noteIds,
          userId,
          title,
          count,
          onProgress: (p) => emit({ type: 'progress', ...p }),
        });
        for (const id of noteIds) revalidateFlashcardPaths(id);
        emit({ type: 'done', result });
      } catch (error) {
        emitFlashcardError(emit, error);
      }
    });
  }

  const parsed = createFlashcardsFromPasteSchema.safeParse(body);
  if (!parsed.success) return jsonError(zodFirstError(parsed.error), 400);
  const { content, title, count } = parsed.data;

  return streamGeneration(async (emit) => {
    try {
      const result = await createNoteAndGenerateFlashcards({
        userId,
        content,
        title,
        count,
        onProgress: (p) => emit({ type: 'progress', ...p }),
      });
      revalidateFlashcardPaths(result.noteId);
      revalidatePath('/dashboard/notes');
      emit({ type: 'done', result });
    } catch (error) {
      emitFlashcardError(emit, error);
    }
  });
}

function emitFlashcardError(
  emit: (event: { type: 'error'; message: string }) => void,
  error: unknown
) {
  if (error instanceof FlashcardServiceError) {
    emit({ type: 'error', message: error.message });
    return;
  }
  if (error instanceof AiProviderError) {
    console.error(
      '[ai] POST /api/flashcards/generate',
      error.message.slice(0, 300)
    );
    emit({ type: 'error', message: aiErrorMessage(error) });
    return;
  }
  console.error('POST /api/flashcards/generate', error);
  emit({ type: 'error', message: 'Failed to generate flashcards.' });
}
