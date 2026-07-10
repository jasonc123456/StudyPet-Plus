'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { ConfirmDialog } from '@/components/courses/ConfirmDialog';

export type CourseCardData = {
  id: string;
  name: string;
  color: string;
  term: string | null;
  credits: number;
  archivedAt: Date | string | null;
  archiveReason: string | null;
  _count: { assignments: number; notes?: number };
};

type CourseCardProps = {
  course: CourseCardData;
};

function formatArchiveDate(value: Date | string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function CourseCard({ course }: CourseCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const archived = Boolean(course.archivedAt);
  const archivedDate = formatArchiveDate(course.archivedAt);

  async function handleArchiveToggle() {
    setArchiving(true);
    setError(null);

    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !archived }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Failed to update archive status');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error - please try again');
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Failed to delete course');
        return;
      }

      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError('Network error - please try again');
    } finally {
      setDeleting(false);
    }
  }

  const assignmentLabel =
    course._count.assignments === 1
      ? '1 task'
      : `${course._count.assignments} tasks`;
  const noteCount = course._count.notes ?? 0;
  const noteLabel = noteCount === 1 ? '1 note' : `${noteCount} notes`;

  return (
    <>
      <article
        className={[
          'group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg',
          archived
            ? 'border-slate-200 opacity-90'
            : 'border-slate-200 hover:border-slate-300',
        ].join(' ')}
      >
        <div className="flex min-h-full">
          <div
            className="w-2 shrink-0"
            style={{ backgroundColor: course.color }}
            aria-hidden
          />
          <div className="flex min-h-full flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ColorSwatch color={course.color} size="sm" />
                  <Link
                    href={`/dashboard/courses/${course.id}/assignments`}
                    className="truncate text-lg font-semibold tracking-tight text-slate-900 hover:text-brand-600"
                  >
                    {course.name}
                  </Link>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                  {course.term && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1">
                      {course.term}
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {course.credits} credits
                  </span>
                  {archived && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                      Archived
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Link
                href={`/dashboard/courses/${course.id}/assignments`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Tasks
                </span>
                <span className="mt-1 block font-semibold text-slate-900">
                  {assignmentLabel}
                </span>
              </Link>
              <Link
                href={`/dashboard/notes?courseId=${course.id}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Notes
                </span>
                <span className="mt-1 block font-semibold text-slate-900">
                  {noteLabel}
                </span>
              </Link>
            </div>

            {archived && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {course.archiveReason ?? 'Archived'}
                {archivedDate ? ` on ${archivedDate}` : ''}.
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-4">
              <Link
                href={`/dashboard/courses/${course.id}/assignments`}
                className="btn-primary text-sm sm:col-span-1"
              >
                Open
              </Link>
              <Link
                href={`/dashboard/courses/${course.id}/edit`}
                className="btn-secondary text-sm sm:col-span-1"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={handleArchiveToggle}
                disabled={archiving}
                className="btn-secondary text-sm disabled:cursor-wait disabled:opacity-70 sm:col-span-1"
              >
                {archiving ? 'Saving...' : archived ? 'Restore' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete course?"
        message={`"${course.name}" and all its assignments will be permanently removed.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
