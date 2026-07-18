// Client-side consumer for the streamed AI generation endpoints.
//
// POSTs `body` to a generate route, reads the SSE stream, reports progress via
// `onProgress`, and resolves with the final `done` payload. Auth/validation
// failures come back as ordinary JSON (not a stream) and are thrown as errors,
// as are `error` events emitted mid-stream.

import type { GenerationStreamEvent } from '@/lib/generation-events';

export type GenerationProgress = {
  phase: 'thinking' | 'writing';
  thinkingChars: number;
  writingChars: number;
};

export async function consumeGenerationStream<T>(
  url: string,
  body: unknown,
  onProgress: (progress: GenerationProgress) => void
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Non-streaming responses (auth 401, validation 400) are JSON, not SSE.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    let message = 'Generation failed. Please try again.';
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  if (!res.body) throw new Error('No response stream from the server.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | undefined;
  let done = false;

  for (;;) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data) continue;

      let event: GenerationStreamEvent;
      try {
        event = JSON.parse(data) as GenerationStreamEvent;
      } catch {
        continue;
      }

      if (event.type === 'progress') {
        onProgress({
          phase: event.phase,
          thinkingChars: event.thinkingChars,
          writingChars: event.writingChars,
        });
      } else if (event.type === 'done') {
        result = event.result as T;
        done = true;
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }
  }

  if (!done || result === undefined) {
    throw new Error('Generation ended unexpectedly. Please try again.');
  }
  return result;
}
