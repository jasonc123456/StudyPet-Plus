'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useFlashcardReviewXp,
  type FlashcardReviewOutcome,
} from '@/hooks/useFlashcardReviewXp';

export type ReviewCard = {
  id: string;
  topic: string;
  front: string;
  back: string;
};

type XpFloat = { id: number; amount: number };

type FlashcardReviewFrameworkProps = {
  deckTitle: string;
  cards: ReviewCard[];
  /** Seconds per card; 0 = off. */
  timerPerCard?: number;
  /** When the per-card timer ends, flip to the answer instead of advancing. */
  autoFlip?: boolean;
};

/**
 * US-3.5 / US-3.6 — interactive flashcard review shell: flip state,
 * known/unknown tallies, and pet XP awards via useFlashcardReviewXp.
 */
export function FlashcardReviewFramework({
  deckTitle,
  cards,
  timerPerCard = 0,
  autoFlip = false,
}: FlashcardReviewFrameworkProps) {
  const { recordReview } = useFlashcardReviewXp();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(() => new Set());
  const [unknownIds, setUnknownIds] = useState<Set<string>>(() => new Set());
  const [xpFloats, setXpFloats] = useState<XpFloat[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(timerPerCard);

  const total = cards.length;
  const card = cards[index];

  const spawnXpFloat = useCallback((amount: number) => {
    const id = Date.now() + Math.random();
    setXpFloats((prev) => [...prev, { id, amount }]);
    window.setTimeout(() => {
      setXpFloats((prev) => prev.filter((gain) => gain.id !== id));
    }, 900);
  }, []);

  const knownCount = knownIds.size;
  const unknownCount = unknownIds.size;
  const reviewedCount = knownCount + unknownCount;

  const goTo = useCallback(
    (nextIndex: number) => {
      if (total === 0) return;
      const wrapped = ((nextIndex % total) + total) % total;
      setFlipped(false);
      setIndex(wrapped);
    },
    [total]
  );

  const flip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const markCard = useCallback(
    (outcome: FlashcardReviewOutcome) => {
      if (!card) return;

      const cardId = card.id;

      setKnownIds((prev) => {
        const next = new Set(prev);
        if (outcome === 'known') next.add(cardId);
        else next.delete(cardId);
        return next;
      });
      setUnknownIds((prev) => {
        const next = new Set(prev);
        if (outcome === 'unknown') next.add(cardId);
        else next.delete(cardId);
        return next;
      });

      if (outcome === 'known') {
        void recordReview({ cardId, outcome }).then((result) => {
          if (result.awarded) {
            spawnXpFloat(result.xp);
          }
        });
      }

      goTo(index + 1);
    },
    [card, goTo, index, recordReview, spawnXpFloat]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === '1') {
        e.preventDefault();
        markCard('unknown');
      } else if (e.key === '2') {
        e.preventDefault();
        markCard('known');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flip, goTo, index, markCard]);

  const sessionComplete = useMemo(
    () => total > 0 && reviewedCount >= total,
    [reviewedCount, total]
  );

  // Reset the per-card countdown whenever the card changes.
  useEffect(() => {
    setSecondsLeft(timerPerCard);
  }, [index, timerPerCard]);

  // Per-card timer: on expiry, flip to the answer (if auto-flip) or advance.
  useEffect(() => {
    if (timerPerCard <= 0 || sessionComplete || !card) return;
    if (secondsLeft <= 0) {
      if (autoFlip && !flipped) {
        setFlipped(true);
        setSecondsLeft(timerPerCard);
      } else {
        goTo(index + 1);
      }
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [
    secondsLeft,
    timerPerCard,
    autoFlip,
    flipped,
    index,
    card,
    goTo,
    sessionComplete,
  ]);

  if (!card) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">No cards to study</p>
        <Link
          href="/dashboard/flashcards"
          className="btn-primary mt-4 inline-flex"
        >
          Back to flashcards
        </Link>
      </div>
    );
  }

  const currentKnown = knownIds.has(card.id);
  const currentUnknown = unknownIds.has(card.id);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/flashcards"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            ← Back to flashcards
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{deckTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          {timerPerCard > 0 && (
            <span
              className="rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums"
              style={{ background: 'var(--btn-secondary-hover)' }}
              aria-label="Seconds left on this card"
            >
              ⏱ {secondsLeft}s
            </span>
          )}
          <p className="theme-muted text-sm font-medium" aria-live="polite">
            {index + 1} / {total}
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-sm"
        aria-label="Review progress"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Known
          </p>
          <p className="text-lg font-semibold text-emerald-700">{knownCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Still learning
          </p>
          <p className="text-lg font-semibold text-amber-700">{unknownCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Reviewed
          </p>
          <p className="text-lg font-semibold text-slate-800">
            {reviewedCount}
          </p>
        </div>
      </div>

      {sessionComplete ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
          <p className="font-semibold text-emerald-900">Session complete</p>
          <p className="mt-1 text-sm text-emerald-800">
            You marked {knownCount} known and {unknownCount} still learning.
          </p>
        </div>
      ) : null}

      <div className="perspective">
        <button
          type="button"
          onClick={flip}
          aria-label={
            flipped
              ? `Answer: ${card.back}. Press to show question.`
              : `Question: ${card.front}. Press to show answer.`
          }
          className={`flashcard-flip preserve-3d relative h-56 w-full transition-transform duration-500 motion-reduce:transition-none ${
            flipped ? 'rotate-y-180' : ''
          }`}
        >
          <div className="backface-hidden card absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 motion-reduce:backface-visible">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
              {card.topic}
            </span>
            <p className="text-center text-lg font-semibold text-slate-800">
              {card.front}
            </p>
            <span className="text-xs text-slate-400">
              Click or press Space / Enter to flip
            </span>
          </div>

          <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-brand-600 p-6 text-center text-white shadow-sm motion-reduce:hidden">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
              {card.topic}
            </span>
            <p className="text-base">{card.back}</p>
          </div>

          {flipped && (
            <div className="absolute inset-0 hidden flex-col items-center justify-center gap-2 rounded-xl bg-brand-600 p-6 text-center text-white shadow-sm motion-reduce:flex">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                {card.topic}
              </span>
              <p className="text-base">{card.back}</p>
            </div>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className={`btn-secondary px-4 py-2 text-sm ${
            currentUnknown ? 'ring-2 ring-amber-400' : ''
          }`}
          onClick={() => markCard('unknown')}
        >
          Still learning
        </button>
        <div className="relative">
          <button
            type="button"
            className={`btn-secondary px-4 py-2 text-sm ${
              currentKnown ? 'ring-2 ring-emerald-400' : ''
            }`}
            onClick={() => markCard('known')}
          >
            Got it
          </button>
          {xpFloats.map((gain) => (
            <span
              key={gain.id}
              className="animate-float-up pointer-events-none absolute left-1/2 top-1/2 z-10 text-sm font-bold text-mint-600 motion-reduce:opacity-0"
              aria-hidden
            >
              +{gain.amount} XP
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          onClick={() => goTo(index - 1)}
          disabled={total <= 1}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          onClick={flip}
        >
          Flip
        </button>
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          onClick={() => goTo(index + 1)}
          disabled={total <= 1}
        >
          Next →
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        Keyboard: Space/Enter flip · ← → navigate · 1 still learning · 2 got it
      </p>
    </div>
  );
}
