'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NOTE_SORT_OPTIONS } from '@/lib/notes-query';

type NoteFiltersProps = {
  courses: { id: string; name: string }[];
};

const fieldClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function NoteFilters({ courses }: NoteFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') ?? '';
  const sort = searchParams.get('sort') ?? 'updated';
  const query = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const next = params.toString();
    router.push(next ? `/dashboard/notes?${next}` : '/dashboard/notes');
  }

  function applySearch() {
    pushParams({ q: searchInput.trim() || null });
  }

  function clearFilters() {
    setSearchInput('');
    router.push('/dashboard/notes');
  }

  const hasActiveFilters = Boolean(courseId || query || sort !== 'updated');

  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="note-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Search
          </label>
          <div className="flex gap-2">
            <input
              id="note-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applySearch();
                }
              }}
              placeholder="Search title or content…"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={applySearch}
              className="btn-secondary shrink-0 px-4"
            >
              Search
            </button>
          </div>
        </div>

        <div className="min-w-[180px]">
          <label
            htmlFor="note-sort"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Sort
          </label>
          <select
            id="note-sort"
            value={sort}
            onChange={(e) =>
              pushParams({
                sort: e.target.value === 'updated' ? null : e.target.value,
              })
            }
            className={fieldClass}
          >
            {NOTE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px]">
          <label
            htmlFor="note-course-filter"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Course
          </label>
          <select
            id="note-course-filter"
            value={courseId}
            onChange={(e) => pushParams({ courseId: e.target.value || null })}
            className={fieldClass}
          >
            <option value="">All courses</option>
            <option value="none">Uncategorized</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
