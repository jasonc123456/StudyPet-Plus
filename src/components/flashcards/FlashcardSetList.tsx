'use client';

import {
  FlashcardSetCard,
  type FlashcardSetData,
} from '@/components/flashcards/FlashcardSetCard';

export type { FlashcardSetData };

type FlashcardSetListProps = {
  sets: FlashcardSetData[];
  topicFilter: string;
};

export function FlashcardSetList({ sets, topicFilter }: FlashcardSetListProps) {
  const filtered = topicFilter
    ? sets
        .map((set) => ({
          ...set,
          cards: set.cards.filter(
            (card) => card.topic.toLowerCase() === topicFilter.toLowerCase()
          ),
        }))
        .filter((set) => set.cards.length > 0)
    : sets;

  if (sets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">No flashcards yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Paste notes above or generate from a saved note to create your first
          set.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">No matching topic</p>
        <p className="mt-1 text-sm text-slate-500">
          No cards match “{topicFilter}”. Clear the topic filter to see all
          sets.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filtered.map((set) => (
        <FlashcardSetCard key={set.id} set={set} />
      ))}
    </div>
  );
}
