'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { GenerationProgress as ProgressData } from '@/lib/generation-stream';

type Phase = 'thinking' | 'writing';

type ProgressState = {
  active: boolean;
  phase: Phase;
  thinkingChars: number;
  writingChars: number;
  elapsedMs: number;
};

const INITIAL: ProgressState = {
  active: false,
  phase: 'thinking',
  thinkingChars: 0,
  writingChars: 0,
  elapsedMs: 0,
};

/**
 * Drives the two-phase generation UI. `begin` before the request, pass `update`
 * to consumeGenerationStream, and `end` in a finally block. An interval keeps
 * the elapsed timer moving even while the model is silently "thinking".
 */
export function useGenerationProgress() {
  const [state, setState] = useState<ProgressState>(INITIAL);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    startRef.current = Date.now();
    setState({ ...INITIAL, active: true });
    stopTimer();
    timerRef.current = setInterval(() => {
      setState((prev) =>
        prev.active
          ? { ...prev, elapsedMs: Date.now() - startRef.current }
          : prev
      );
    }, 200);
  }, [stopTimer]);

  const update = useCallback((progress: ProgressData) => {
    setState((prev) => ({
      ...prev,
      active: true,
      phase: progress.phase,
      thinkingChars: progress.thinkingChars,
      writingChars: progress.writingChars,
    }));
  }, []);

  const end = useCallback(() => {
    stopTimer();
    setState((prev) => ({ ...prev, active: false }));
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return { state, begin, update, end };
}

function phaseLabel(phase: Phase, noun: string): string {
  return phase === 'thinking'
    ? 'Thinking through your notes…'
    : `Writing ${noun}…`;
}

export function GenerationProgress({
  state,
  noun = 'flashcards',
}: {
  state: ProgressState;
  /** What's being written, e.g. "flashcards" or "quiz questions". */
  noun?: string;
}) {
  if (!state.active) return null;

  const seconds = Math.floor(state.elapsedMs / 1000);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-brand-800">
          {phaseLabel(state.phase, noun)}
        </span>
        <span className="tabular-nums text-xs text-brand-700/80">
          {seconds}s
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-brand-100">
        <div className="gen-slide absolute inset-y-0 w-1/3 rounded-full bg-brand-500" />
      </div>

      <p className="text-xs text-brand-700/80">
        Local AI thinks before it answers, so this can take a bit longer than a
        hosted model.
      </p>

      <style jsx>{`
        .gen-slide {
          animation: gen-slide 1.15s ease-in-out infinite;
        }
        @keyframes gen-slide {
          0% {
            left: -35%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}
