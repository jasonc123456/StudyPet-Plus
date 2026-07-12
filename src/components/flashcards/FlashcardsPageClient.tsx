'use client';

import { useMemo, useState } from 'react';

import { CreateFlashcardsPanel } from '@/components/flashcards/CreateFlashcardsPanel';
import type { NoteOption } from '@/components/flashcards/CreateFlashcardsPanel';
import type { FlashcardSetData } from '@/components/flashcards/FlashcardSetCard';
import { FlashcardSetList } from '@/components/flashcards/FlashcardSetList';

type FlashcardsPageClientProps = {
  sets: FlashcardSetData[];
  notes: NoteOption[];
};

export function FlashcardsPageClient({
  sets,
  notes,
}: FlashcardsPageClientProps) {
  const [topicFilter, setTopicFilter] = useState('');

  const allTopics = useMemo(() => {
    const topics = new Set<string>();
    for (const set of sets) {
      for (const topic of set.topics) {
        topics.add(topic);
      }
    }
    return Array.from(topics).sort((a, b) => a.localeCompare(b));
  }, [sets]);

  return (
    <div className="flex flex-col gap-6">
      <CreateFlashcardsPanel
        notes={notes}
        defaultExpanded={sets.length === 0}
      />

      {sets.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="topic-filter"
            className="text-sm font-medium text-slate-700"
          >
            Filter by topic
          </label>
          <select
            id="topic-filter"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">All topics</option>
            {allTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your sets
        </h2>
        <FlashcardSetList sets={sets} topicFilter={topicFilter} />
      </section>
    </div>
  );
}
