'use client';

import { useMemo, useState } from 'react';

import {
  CLASS_ALL,
  CLASS_UNCATEGORIZED,
  ClassPicker,
  type ClassOption,
} from '@/components/common/ClassPicker';
import { StatTile } from '@/components/common/StatTile';
import { CreateFlashcardsPanel } from '@/components/flashcards/CreateFlashcardsPanel';
import type { FlashcardNoteOption } from '@/components/flashcards/CreateFlashcardsPanel';
import type { FlashcardSetData } from '@/components/flashcards/FlashcardSetCard';
import { FlashcardSetList } from '@/components/flashcards/FlashcardSetList';

type FlashcardsPageClientProps = {
  sets: FlashcardSetData[];
  notes: FlashcardNoteOption[];
  streak: number;
  totalCards: number;
};

export function FlashcardsPageClient({
  sets,
  notes,
  streak,
  totalCards,
}: FlashcardsPageClientProps) {
  const [classFilter, setClassFilter] = useState<string>(CLASS_ALL);

  const courses = useMemo<ClassOption[]>(() => {
    const map = new Map<string, ClassOption>();
    for (const set of sets) {
      if (set.course) map.set(set.course.id, set.course);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);

  const visibleSets = useMemo(() => {
    if (classFilter === CLASS_ALL) return sets;
    if (classFilter === CLASS_UNCATEGORIZED) {
      return sets.filter((set) => !set.course);
    }
    return sets.filter((set) => set.course?.id === classFilter);
  }, [sets, classFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          icon="🔥"
          value={streak}
          label={`Day streak${streak === 1 ? '' : 's'}`}
          tone="warning"
        />
        <StatTile icon="🃏" value={totalCards} label="Cards in your decks" />
      </div>

      <CreateFlashcardsPanel
        notes={notes}
        defaultExpanded={sets.length === 0}
      />

      {courses.length > 0 && (
        <ClassPicker
          courses={courses}
          value={classFilter}
          onChange={setClassFilter}
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="theme-muted text-sm font-semibold uppercase tracking-wide">
          Your decks
        </h2>
        <FlashcardSetList sets={visibleSets} topicFilter="" />
      </section>
    </div>
  );
}
