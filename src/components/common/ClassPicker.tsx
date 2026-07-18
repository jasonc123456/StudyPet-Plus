'use client';

import { useMemo, useState } from 'react';

import { Chip } from '@/components/common/Chip';

export type ClassOption = { id: string; name: string; color: string };

/** Sentinel filter values alongside real course ids. */
export const CLASS_ALL = '__all__';
export const CLASS_UNCATEGORIZED = '__uncategorized__';

export type ClassPickerProps = {
  courses: ClassOption[];
  /** CLASS_ALL, CLASS_UNCATEGORIZED, or a course id. */
  value: string;
  onChange: (value: string) => void;
  /** Show the "Uncategorized" chip (default true). */
  includeUncategorized?: boolean;
};

/**
 * Searchable course filter rendered as colored chips, with All +
 * Uncategorized. Shared by the quizzes and flashcards pages.
 */
export function ClassPicker({
  courses,
  value,
  onChange,
  includeUncategorized = true,
}: ClassPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q));
  }, [courses, query]);

  return (
    <div className="flex flex-col gap-3">
      {courses.length > 6 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search classes…"
          className="theme-input max-w-xs text-sm"
          aria-label="Search classes"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Chip
          selected={value === CLASS_ALL}
          onClick={() => onChange(CLASS_ALL)}
        >
          All
        </Chip>
        {filtered.map((course) => (
          <Chip
            key={course.id}
            color={course.color}
            selected={value === course.id}
            onClick={() => onChange(course.id)}
          >
            {course.name}
          </Chip>
        ))}
        {includeUncategorized && (
          <Chip
            selected={value === CLASS_UNCATEGORIZED}
            onClick={() => onChange(CLASS_UNCATEGORIZED)}
          >
            Uncategorized
          </Chip>
        )}
      </div>
    </div>
  );
}
