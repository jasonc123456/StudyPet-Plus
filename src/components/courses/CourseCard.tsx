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
  _count: { assignments: number };
};

type CourseCardProps = {
  course: CourseCardData;
};

export function CourseCard({ course }: CourseCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Network error — please try again');
    } finally {
      setDeleting(false);
    }
  }

  const assignmentLabel =
    course._count.assignments === 1
      ? '1 assignment'
      : `${course._count.assignments} assignments`;

  return (
    <>
      <div className="card flex flex-col p-5">
        <div className="flex items-start gap-3">
          <ColorSwatch color={course.color} size="md" className="mt-1" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-slate-900">
              {course.name}
            </h2>
            {course.term && (
              <p className="mt-0.5 text-sm text-slate-500">{course.term}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">{assignmentLabel}</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <Link
            href={`/dashboard/courses/${course.id}/edit`}
            className="btn-secondary flex-1 text-center text-sm"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

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
