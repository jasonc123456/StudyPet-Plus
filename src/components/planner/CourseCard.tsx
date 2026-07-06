'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ColorSwatch } from '@/components/planner/ColorSwatch';
import { ConfirmDialog } from '@/components/planner/ConfirmDialog';

type CourseCardProps = {
  id: string;
  name: string;
  color: string;
  term: string | null;
  assignmentCount: number;
};

export function CourseCard({
  id,
  name,
  color,
  term,
  assignmentCount,
}: CourseCardProps) {
  const router = useRouter();

  async function handleDelete() {
    const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Failed to delete course');
    }
    router.refresh();
  }

  return (
    <article className="card flex flex-col p-5">
      <Link
        href={`/dashboard/courses/${id}/assignments`}
        className="group flex flex-1 flex-col"
      >
        <div className="flex items-start gap-3">
          <ColorSwatch color={color} size="lg" className="mt-1" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-slate-900 group-hover:text-brand-600">
              {name}
            </h2>
            {term && <p className="mt-0.5 text-sm text-slate-500">{term}</p>}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}
        </p>
      </Link>

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
        <Link
          href={`/dashboard/courses/${id}/edit`}
          className="btn-secondary flex-1 py-1.5 text-sm"
        >
          Edit
        </Link>
        <ConfirmDialog
          title="Delete course?"
          message="This will permanently delete the course and all its assignments."
          onConfirm={handleDelete}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          )}
        />
      </div>
    </article>
  );
}
