'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ASSIGNMENT_STATUSES } from '@/lib/constants';

/**
 * Status picker for a calendar agenda card.
 *
 * A status only exists on events backed by an Assignment row — one the student
 * created on the Tasks page, or one auto-sync materialized from a calendar feed.
 * A raw feed event has no row to write to, so the control renders dimmed with a
 * "?" explaining that enabling sync for that calendar is what unlocks it.
 */

// Matches AssignmentStatusSelect on the Tasks page: only the current status is
// filled, so switching is always one click.
const STATUS_ACTIVE_CLASSES: Record<string, string> = {
  todo: 'bg-slate-600 text-white shadow-sm',
  in_progress: 'bg-amber-500 text-white shadow-sm',
  done: 'bg-emerald-600 text-white shadow-sm',
};

const SYNC_REQUIRED_HINT =
  'This event comes from an external calendar. Turn on sync for that calendar to track it as a task and set its status.';

/** Identifies the assignment a status write lands on. Null ⇒ nothing to write. */
export type StatusTarget = {
  courseId: string;
  assignmentId: string;
};

type CalendarEventStatusControlProps = {
  title: string;
  status: string | null;
  target: StatusTarget | null;
};

function SyncRequiredHint() {
  return (
    <span
      tabIndex={0}
      role="img"
      aria-label={SYNC_REQUIRED_HINT}
      title={SYNC_REQUIRED_HINT}
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      ?
    </span>
  );
}

export function CalendarEventStatusControl({
  title,
  status,
  target,
}: CalendarEventStatusControlProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = target !== null;

  async function selectStatus(nextStatus: string) {
    if (!target || nextStatus === current) return;

    const previousStatus = current;
    setCurrent(nextStatus);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/courses/${target.courseId}/assignments/${target.assignmentId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setCurrent(previousStatus);
        setError(data?.error ?? 'Failed to update status');
        return;
      }

      router.refresh();
    } catch {
      setCurrent(previousStatus);
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label={`Change status for ${title}`}
        aria-disabled={!editable}
        // The tooltip lives here rather than on the buttons: browsers suppress
        // `title` on a disabled control.
        title={editable ? undefined : SYNC_REQUIRED_HINT}
        className={[
          'inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5',
          editable ? '' : 'cursor-help opacity-50',
        ].join(' ')}
      >
        {ASSIGNMENT_STATUSES.map((assignmentStatus) => {
          const active = editable && assignmentStatus.value === current;
          return (
            <button
              key={assignmentStatus.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!editable || saving || active}
              onClick={() => selectStatus(assignmentStatus.value)}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 py-0 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                active
                  ? (STATUS_ACTIVE_CLASSES[assignmentStatus.value] ??
                    'bg-slate-600 text-white shadow-sm')
                  : `text-slate-500 ${
                      editable
                        ? `hover:text-slate-800 ${saving ? 'cursor-wait opacity-60' : ''}`
                        : 'cursor-help'
                    }`
              }`}
            >
              {assignmentStatus.label}
            </button>
          );
        })}
      </div>

      {!editable && <SyncRequiredHint />}

      {error && <p className="basis-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
