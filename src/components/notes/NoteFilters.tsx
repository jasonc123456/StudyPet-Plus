'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type NoteFiltersProps = {
  courses: { id: string; name: string }[];
};

export function NoteFilters({ courses }: NoteFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') ?? '';

  function handleChange(nextCourseId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextCourseId) {
      params.set('courseId', nextCourseId);
    } else {
      params.delete('courseId');
    }
    const query = params.toString();
    router.push(query ? `/dashboard/notes?${query}` : '/dashboard/notes');
  }

  return (
    <div className="card flex flex-wrap items-end gap-4 p-4">
      <div className="min-w-[200px] flex-1">
        <label
          htmlFor="note-course-filter"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Course
        </label>
        <select
          id="note-course-filter"
          value={courseId}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
  );
}
