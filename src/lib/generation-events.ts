// Wire format for streamed AI generation (flashcards + quizzes).
//
// Shared by the SSE route helper (server) and the stream consumer (client) so
// the two can't drift. `result` is the same JSON payload the endpoint used to
// return synchronously — the client casts it to the shape it expects.

import type { AiProgressPhase } from '@/lib/ai/types';

export type GenerationStreamEvent =
  | {
      type: 'progress';
      phase: AiProgressPhase;
      thinkingChars: number;
      writingChars: number;
    }
  | { type: 'done'; result: unknown }
  | { type: 'error'; message: string };
