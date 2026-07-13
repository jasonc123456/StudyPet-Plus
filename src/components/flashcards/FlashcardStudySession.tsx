'use client';

import {
  FlashcardReviewFramework,
  type ReviewCard,
} from '@/components/flashcards/FlashcardReviewFramework';

export type StudyCard = ReviewCard;

type FlashcardStudySessionProps = {
  noteTitle: string;
  cards: StudyCard[];
};

/** Thin wrapper — study route uses the US-3.5 review framework. */
export function FlashcardStudySession({
  noteTitle,
  cards,
}: FlashcardStudySessionProps) {
  return <FlashcardReviewFramework noteTitle={noteTitle} cards={cards} />;
}
