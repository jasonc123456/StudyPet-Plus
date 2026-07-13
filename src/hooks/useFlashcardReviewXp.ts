'use client';

import { useCallback, useRef } from 'react';

import { FLASHCARD_REVIEW_XP } from '@/lib/pet-xp.constants';

export { FLASHCARD_REVIEW_XP };

export type FlashcardReviewOutcome = 'known' | 'unknown';

export type FlashcardReviewXpEvent = {
  cardId: string;
  outcome: FlashcardReviewOutcome;
};

export type FlashcardReviewXpResult = {
  awarded: boolean;
  xp: number;
};

const XP_REQUEST_TIMEOUT_MS = 8_000;

type PetXpResponse = {
  xpAwarded?: number;
  error?: string;
};

/**
 * US-3.6 — awards pet XP when a flashcard is marked during review.
 * Resolves with whether XP was granted so the UI can show live feedback.
 * Failures never throw — study flow is never interrupted.
 */
export function useFlashcardReviewXp() {
  const inFlightRef = useRef<Set<string>>(new Set());

  const recordReview = useCallback(
    async (event: FlashcardReviewXpEvent): Promise<FlashcardReviewXpResult> => {
      if (event.outcome !== 'known') {
        return { awarded: false, xp: 0 };
      }

      if (inFlightRef.current.has(event.cardId)) {
        return { awarded: false, xp: 0 };
      }
      inFlightRef.current.add(event.cardId);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        XP_REQUEST_TIMEOUT_MS
      );

      try {
        const response = await fetch('/api/pet/xp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'flashcard_review',
            cardId: event.cardId,
            outcome: event.outcome,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn(
            '[xp] flashcard review award failed',
            response.status,
            event.cardId
          );
          return { awarded: false, xp: 0 };
        }

        const data = (await response.json()) as PetXpResponse;
        const xp =
          typeof data.xpAwarded === 'number' && data.xpAwarded > 0
            ? data.xpAwarded
            : 0;

        return { awarded: xp > 0, xp };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.warn('[xp] flashcard review award timed out', event.cardId);
        } else {
          console.warn('[xp] flashcard review award error', error);
        }
        return { awarded: false, xp: 0 };
      } finally {
        window.clearTimeout(timeoutId);
        inFlightRef.current.delete(event.cardId);
      }
    },
    []
  );

  return { recordReview };
}
