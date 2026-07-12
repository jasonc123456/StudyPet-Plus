import { NextResponse } from 'next/server';

import { AiProviderError } from '@/lib/ai/provider';
import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  FlashcardServiceError,
  generateAndSaveFlashcards,
} from '@/lib/flashcards';
import {
  generateFlashcardsRequestSchema,
  zodFirstError,
} from '@/lib/validators';

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = generateFlashcardsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  try {
    const result = await generateAndSaveFlashcards({
      noteId: parsed.data.noteId,
      userId: authResult.user.id,
      count: parsed.data.count,
      replaceGenerated: parsed.data.replaceGenerated,
    });
    return jsonOk(result, 201);
  } catch (error) {
    if (error instanceof FlashcardServiceError) {
      if (error.code === 'NOT_FOUND') {
        return jsonError(error.message, 404);
      }
      return jsonError(error.message, 400);
    }

    if (error instanceof AiProviderError) {
      console.error(
        '[ai] POST /api/flashcards/generate',
        error.message.slice(0, 300)
      );
      const notConfigured = /not configured|GEMINI_API_KEY/i.test(
        error.message
      );
      return jsonError(
        notConfigured
          ? 'AI generation is not configured. Set GEMINI_API_KEY on the server.'
          : 'Flashcard generation failed. The AI provider timed out or returned an invalid response. Please try again.',
        notConfigured ? 503 : 502
      );
    }

    console.error('POST /api/flashcards/generate', error);
    return jsonError('Failed to generate flashcards', 500);
  }
}
