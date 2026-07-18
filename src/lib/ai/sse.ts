// Server-Sent Events helper for streamed AI generation.
//
// A route hands `streamGeneration` a worker that does the real work and calls
// `emit` with progress/done/error events. The worker owns error handling (so it
// can map service errors to friendly messages); the catch here is a safety net.

import type { GenerationStreamEvent } from '@/lib/generation-events';

export function streamGeneration(
  worker: (emit: (event: GenerationStreamEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: GenerationStreamEvent) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };
      try {
        await worker(emit);
      } catch (err) {
        console.error('[ai] streamGeneration worker crashed', err);
        emit({
          type: 'error',
          message: 'Generation failed. Please try again.',
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Stop nginx (the reverse proxy) from buffering the stream.
      'x-accel-buffering': 'no',
    },
  });
}
