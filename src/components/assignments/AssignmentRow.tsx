'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TypeBadge } from '@/components/assignments/TypeBadge';
import { ColorSwatch } from '@/components/courses/ColorSwatch';
import { ConfirmDialog } from '@/components/courses/ConfirmDialog';
import { DueDate } from '@/components/DueDate';
import { ASSIGNMENT_STATUSES } from '@/lib/constants';

export type AssignmentRowData = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueAt: Date | string | null;
  status: string;
  type: string;
  course?: { id: string; name: string; color: string };
};

type AssignmentRowProps = {
  assignment: AssignmentRowData;
  showCourse?: boolean;
};

export function AssignmentRow({
  assignment,
  showCourse = false,
}: AssignmentRowProps) {
  const router = useRouter();
  const [status, setStatus] = useState(assignment.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editHref = `/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}/edit`;

  async function handleStatusChange(nextStatus: string) {
    const previousStatus = status;
    setStatus(nextStatus);
    setSavingStatus(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/courses/${assignment.courseId}/assignments/${assignment.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatus(previousStatus);
        setError(data?.error ?? 'Failed to update status');
        return;
      }

      router.refresh();
    } catch {
      setStatus(previousStatus);
      setError('Network error — please try again');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/courses/${assignment.courseId}/assignments/${assignment.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Failed to delete assignment');
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

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-3">
          <Link
            href={editHref}
            className="font-medium text-slate-900 hover:text-brand-600"
          >
            {assignment.title}
          </Link>
          {assignment.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {assignment.description}
            </p>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
        {showCourse && assignment.course && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <ColorSwatch color={assignment.course.color} size="sm" />
              <span className="text-sm text-slate-600">
                {assignment.course.name}
              </span>
            </div>
          </td>
        )}
        <td className="px-4 py-3 text-sm text-slate-600">
          <DueDate dueAt={assignment.dueAt} />
        </td>
        <td className="px-4 py-3">
          <select
            aria-label={`Change status for ${assignment.title}`}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={savingStatus}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-wait disabled:opacity-70"
          >
            {ASSIGNMENT_STATUSES.map((assignmentStatus) => (
              <option
                key={assignmentStatus.value}
                value={assignmentStatus.value}
              >
                {assignmentStatus.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <TypeBadge type={assignment.type} />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <Link href={editHref} className="btn-secondary text-xs px-3 py-1.5">
              Edit
            </Link>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete assignment?"
        message={`"${assignment.title}" will be permanently removed.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
