'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { STATUS_BADGE_STYLES } from '@/components/assignments/StatusBadge';
import { getNextAssignmentStatus } from '@/lib/assignment-status';
import { statusLabel } from '@/lib/format';

type InlineAssignmentStatusBadgeProps = {
  courseId: string;
  assignmentId: string;
  status: string;
  title: string;
};

export function InlineAssignmentStatusBadge({
  courseId,
  assignmentId,
  status: initialStatus,
  title,
}: InlineAssignmentStatusBadgeProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (saving) return;

    const nextStatus = getNextAssignmentStatus(status);
    const previousStatus = status;

    setStatus(nextStatus);
    setSaving(true);

    try {
      const res = await fetch(
        `/api/courses/${courseId}/assignments/${assignmentId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!res.ok) {
        setStatus(previousStatus);
        return;
      }

      router.refresh();
    } catch {
      setStatus(previousStatus);
    } finally {
      setSaving(false);
    }
  }

  const badgeStyle =
    STATUS_BADGE_STYLES[status] ??
    'bg-slate-50/90 text-slate-500 ring-1 ring-inset ring-slate-200/70';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      aria-label={`Change status for ${title}. Current: ${statusLabel(status)}`}
      title="Click to update status"
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide transition-all duration-200 hover:opacity-80 disabled:cursor-wait disabled:opacity-60 ${badgeStyle}`}
    >
      {statusLabel(status)}
    </button>
  );
}
