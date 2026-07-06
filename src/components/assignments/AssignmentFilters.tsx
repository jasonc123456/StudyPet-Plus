'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES } from '@/lib/constants';

type CourseOption = { id: string; name: string };

type AssignmentFiltersProps = {
  courses: CourseOption[];
};

export function AssignmentFilters({ courses }: AssignmentFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const courseId = searchParams.get('courseId') ?? '';

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/assignments?${params.toString()}`);
  }

  const selectClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-black shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <div className="card flex flex-wrap gap-3 p-4">
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => updateFilter('status', e.target.value)}
        className={selectClass}
      >
        <option value="">All statuses</option>
        {ASSIGNMENT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by type"
        value={type}
        onChange={(e) => updateFilter('type', e.target.value)}
        className={selectClass}
      >
        <option value="">All types</option>
        {ASSIGNMENT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by course"
        value={courseId}
        onChange={(e) => updateFilter('courseId', e.target.value)}
        className={selectClass}
      >
        <option value="">All courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
