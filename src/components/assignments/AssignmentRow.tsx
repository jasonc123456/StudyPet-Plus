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
  /** Set when calendar auto-sync created this row rather than the user. */
  calendarSubscription?: { name: string } | null;
};

type AssignmentRowProps = {
  assignment: AssignmentRowData;
  showCourse?: boolean;
};

/**
 * Marks a row the feed owns: its title, description and due date are rewritten
 * on every sync, so edits there won't stick (status and course will).
 */
function SyncedBadge({ name }: { name: string }) {
  return (
    <span
      title={`Auto-synced from ${name} — title, description and due date follow the calendar feed`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
        <path
          d="M13 8a5 5 0 0 1-8.5 3.5M3 8a5 5 0 0 1 8.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M11 2v3H8M5 14v-3h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {name}
    </span>
  );
}

function useAssignmentRowState(assignment: AssignmentRowData) {
  const router = useRouter();
  const [status, setStatus] = useState(assignment.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clicking a title opens the read-only view; editing stays an explicit action.
  const viewHref = `/dashboard/courses/${assignment.courseId}/assignments/${assignment.id}`;
  const editHref = `${viewHref}/edit`;

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

  return {
    status,
    savingStatus,
    confirmOpen,
    deleting,
    error,
    viewHref,
    editHref,
    setConfirmOpen,
    handleStatusChange,
    handleDelete,
  };
}

// Active-segment styling per status. Inactive segments stay plain so only the
// current status is visually filled; picking any other one is a single click.
const STATUS_ACTIVE_CLASSES: Record<string, string> = {
  todo: 'bg-slate-600 text-white shadow-sm',
  in_progress: 'bg-amber-500 text-white shadow-sm',
  done: 'bg-emerald-600 text-white shadow-sm',
};

function AssignmentStatusSelect({
  title,
  status,
  savingStatus,
  onChange,
}: {
  title: string;
  status: string;
  savingStatus: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Change status for ${title}`}
      className="inline-flex w-full items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5 sm:w-auto"
    >
      {ASSIGNMENT_STATUSES.map((assignmentStatus) => {
        const active = assignmentStatus.value === status;
        return (
          <button
            key={assignmentStatus.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={savingStatus || active}
            onClick={() => onChange(assignmentStatus.value)}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:flex-none ${
              active
                ? (STATUS_ACTIVE_CLASSES[assignmentStatus.value] ??
                  'bg-slate-600 text-white shadow-sm')
                : `text-slate-500 hover:text-slate-800 ${
                    savingStatus ? 'cursor-wait opacity-60' : ''
                  }`
            }`}
          >
            {assignmentStatus.label}
          </button>
        );
      })}
    </div>
  );
}

function AssignmentRowActions({
  editHref,
  onDelete,
  fullWidth = false,
}: {
  editHref: string;
  onDelete: () => void;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'flex gap-2' : 'flex justify-end gap-2'}>
      <Link
        href={editHref}
        data-action="edit"
        className={
          fullWidth
            ? 'btn-secondary flex-1 text-center text-xs'
            : 'btn-secondary shrink-0 whitespace-nowrap px-3 py-1.5 text-xs'
        }
      >
        Edit
      </Link>
      <button
        type="button"
        data-action="delete"
        onClick={onDelete}
        className={
          fullWidth
            ? 'flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50'
            : 'shrink-0 whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50'
        }
      >
        Delete
      </button>
    </div>
  );
}

function AssignmentDeleteDialog({
  open,
  title,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Delete task?"
      message={`"${title}" will be permanently removed.`}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function AssignmentMobileCard({
  assignment,
  showCourse = false,
}: AssignmentRowProps) {
  const {
    status,
    savingStatus,
    confirmOpen,
    deleting,
    error,
    viewHref,
    editHref,
    setConfirmOpen,
    handleStatusChange,
    handleDelete,
  } = useAssignmentRowState(assignment);

  return (
    <>
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={viewHref}
            className="font-medium text-slate-900 hover:text-brand-600"
          >
            {assignment.title}
          </Link>
          {assignment.calendarSubscription && (
            <SyncedBadge name={assignment.calendarSubscription.name} />
          )}
        </div>

        {assignment.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {assignment.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {showCourse && assignment.course && (
            <span className="inline-flex items-center gap-1.5">
              <ColorSwatch color={assignment.course.color} size="sm" />
              {assignment.course.name}
            </span>
          )}
          <span>
            Due <DueDate dueAt={assignment.dueAt} />
          </span>
          <TypeBadge type={assignment.type} />
        </div>

        <div className="mt-3">
          <AssignmentStatusSelect
            title={assignment.title}
            status={status}
            savingStatus={savingStatus}
            onChange={handleStatusChange}
          />
        </div>

        <div className="mt-3">
          <AssignmentRowActions
            editHref={editHref}
            onDelete={() => setConfirmOpen(true)}
            fullWidth
          />
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <AssignmentDeleteDialog
        open={confirmOpen}
        title={assignment.title}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export function AssignmentRow({
  assignment,
  showCourse = false,
}: AssignmentRowProps) {
  const {
    status,
    savingStatus,
    confirmOpen,
    deleting,
    error,
    viewHref,
    editHref,
    setConfirmOpen,
    handleStatusChange,
    handleDelete,
  } = useAssignmentRowState(assignment);

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={viewHref}
              className="font-medium text-slate-900 hover:text-brand-600"
            >
              {assignment.title}
            </Link>
            {assignment.calendarSubscription && (
              <SyncedBadge name={assignment.calendarSubscription.name} />
            )}
          </div>
          {assignment.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {assignment.description}
            </p>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
        {showCourse && assignment.course && (
          <td className="px-2 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2">
              <ColorSwatch color={assignment.course.color} size="sm" />
              <span className="text-sm text-slate-600">
                {assignment.course.name}
              </span>
            </div>
          </td>
        )}
        <td className="px-2 py-2.5 text-sm text-slate-600 sm:px-4 sm:py-3">
          <DueDate dueAt={assignment.dueAt} />
        </td>
        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
          <AssignmentStatusSelect
            title={assignment.title}
            status={status}
            savingStatus={savingStatus}
            onChange={handleStatusChange}
          />
        </td>
        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
          <TypeBadge type={assignment.type} />
        </td>
        <td className="px-2 py-2.5 text-right sm:px-4 sm:py-3">
          <AssignmentRowActions
            editHref={editHref}
            onDelete={() => setConfirmOpen(true)}
          />
        </td>
      </tr>

      <AssignmentDeleteDialog
        open={confirmOpen}
        title={assignment.title}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
