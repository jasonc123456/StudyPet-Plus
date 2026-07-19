'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { GenerationProgress as ProgressData } from '@/lib/generation-stream';

// Client-side phase. "connecting" is ours: it covers the gap between the POST
// and the model's first streamed token (sending the prompt + the model warming
// up). "thinking" and "writing" mirror the server's streamed phases.
type Phase = 'connecting' | 'thinking' | 'writing';

type ProgressState = {
  active: boolean;
  phase: Phase;
  thinkingChars: number;
  writingChars: number;
  /** Total time since begin(). */
  elapsedMs: number;
  /** Time since the current phase started — drives the writing-phase estimate. */
  phaseElapsedMs: number;
};

const INITIAL: ProgressState = {
  active: false,
  phase: 'connecting',
  thinkingChars: 0,
  writingChars: 0,
  elapsedMs: 0,
  phaseElapsedMs: 0,
};

// Reassure the user on slow local runs instead of leaving them guessing.
const SLOW_SECONDS = 30;
const VERY_SLOW_SECONDS = 60;

/**
 * Drives the multi-stage generation UI. `begin` before the request, pass
 * `update` to consumeGenerationStream, and `end` in a finally block. An interval
 * keeps the elapsed timers moving even while the model is silently "thinking",
 * so the estimated bar and the timer never freeze between token bursts.
 */
export function useGenerationProgress() {
  const [state, setState] = useState<ProgressState>(INITIAL);
  const startRef = useRef<number>(0);
  const phaseStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    const now = Date.now();
    startRef.current = now;
    phaseStartRef.current = now;
    setState({ ...INITIAL, active: true, phase: 'connecting' });
    stopTimer();
    timerRef.current = setInterval(() => {
      setState((prev) =>
        prev.active
          ? {
              ...prev,
              elapsedMs: Date.now() - startRef.current,
              phaseElapsedMs: Date.now() - phaseStartRef.current,
            }
          : prev
      );
    }, 200);
  }, [stopTimer]);

  const update = useCallback((progress: ProgressData) => {
    setState((prev) => {
      const phaseChanged = prev.phase !== progress.phase;
      if (phaseChanged) phaseStartRef.current = Date.now();
      return {
        ...prev,
        active: true,
        phase: progress.phase,
        thinkingChars: progress.thinkingChars,
        writingChars: progress.writingChars,
        phaseElapsedMs: phaseChanged ? 0 : prev.phaseElapsedMs,
      };
    });
  }, []);

  const end = useCallback(() => {
    stopTimer();
    setState((prev) => ({ ...prev, active: false }));
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return { state, begin, update, end };
}

function phaseLabel(phase: Phase, noun: string, source: string): string {
  if (phase === 'connecting') return `Sending ${source} to the model…`;
  if (phase === 'thinking') return `Thinking through ${source}…`;
  return `Writing ${noun}…`;
}

/**
 * Soft ETA fraction in [0, 1). The real total is unknowable, so this is a
 * decelerating estimate that never reaches 100% on its own — it only fills as
 * time passes and jumps at real milestones (connecting → thinking → writing).
 * When generation finishes the component unmounts, so we never fake completion.
 */
function estimateFraction(state: ProgressState): number {
  const total = state.elapsedMs / 1000;
  if (state.phase === 'connecting') {
    // Creep up to ~6% while we wait for the first token.
    return Math.min(0.06, total * 0.03);
  }
  if (state.phase === 'thinking') {
    // Ease from ~6% toward ~55%, decelerating (τ ≈ 22s).
    return 0.06 + 0.49 * (1 - Math.exp(-total / 22));
  }
  // writing: jump to a 60% floor, then ease toward ~97% over the writing phase.
  const w = state.phaseElapsedMs / 1000;
  return 0.6 + 0.37 * (1 - Math.exp(-w / 30));
}

function helperCopy(
  seconds: number,
  source: string,
  sourcePlural: string
): string {
  if (seconds >= VERY_SLOW_SECONDS) {
    return `Still working — longer ${sourcePlural} take more time. It hasn't stalled; the model is finishing up.`;
  }
  if (seconds >= SLOW_SECONDS) {
    return `This is taking a little longer than usual, but the model is still working hard on ${source}.`;
  }
  return 'Local AI reasons before it answers, so this can take a bit longer than a hosted model.';
}

export function GenerationProgress({
  state,
  noun = 'flashcards',
  source = 'your notes',
  sourcePlural = 'notes',
}: {
  state: ProgressState;
  /** What's being written, e.g. "flashcards" or "quiz questions". */
  noun?: string;
  /** The source material, e.g. "your notes" or "your course plan". */
  source?: string;
  /** Plural source material for slow-run copy, e.g. "notes" or "plans". */
  sourcePlural?: string;
}) {
  if (!state.active) return null;

  const seconds = Math.floor(state.elapsedMs / 1000);
  const pct = Math.round(estimateFraction(state) * 100);
  const isSlow = seconds >= SLOW_SECONDS;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-brand-800">
          {phaseLabel(state.phase, noun, source)}
        </span>
        <span className="tabular-nums text-xs text-brand-700/80">
          ~{pct}% · {seconds}s
        </span>
      </div>

      <div className="relative h-2 w-full overflow-hidden rounded-full bg-brand-100">
        <div
          className="gen-fill absolute inset-y-0 left-0 rounded-full bg-brand-500"
          style={{ width: `${Math.max(pct, 2)}%` }}
        >
          {/* Animated sheen keeps the bar alive even when the estimate is flat. */}
          <div className="gen-sheen absolute inset-0" />
        </div>
      </div>

      <p
        className={
          isSlow
            ? 'text-xs font-medium text-amber-700'
            : 'text-xs text-brand-700/80'
        }
      >
        {helperCopy(seconds, source, sourcePlural)}
      </p>

      <style jsx>{`
        .gen-fill {
          transition: width 0.4s ease-out;
        }
        .gen-sheen {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.55),
            transparent
          );
          animation: gen-sheen 1.4s ease-in-out infinite;
        }
        @keyframes gen-sheen {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
