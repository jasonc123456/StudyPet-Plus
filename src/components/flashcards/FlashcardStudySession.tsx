'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export type StudyCard = {
  id: string;
  topic: string;
  front: string;
  back: string;
};

type FlashcardStudySessionProps = {
  noteTitle: string;
  cards: StudyCard[];
};

export function FlashcardStudySession({
  noteTitle,
  cards,
}: FlashcardStudySessionProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];
  const total = cards.length;

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
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flip, goTo, index]);

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
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {noteTitle}
          </h1>
        </div>
        <p className="text-sm font-medium text-slate-500" aria-live="polite">
          {index + 1} / {total}
        </p>
      </div>

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

          {/* Reduced-motion: show answer as a simple swap without 3D */}
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
        Keyboard: Space/Enter flip · ← previous · → next
      </p>
    </div>
  );
}
