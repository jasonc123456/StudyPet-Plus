'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatCalendarDate, formatCalendarTime } from '@/lib/calendar-format';

type CalendarTaskChecklistItem = {
  id: string;
  source: 'assignment' | 'quest' | 'group_task';
  sourceId: string;
  title: string;
  dueAt: Date | string;
  status: string;
  href: string;
  courseId?: string;
  groupId?: string;
  meta: string | null;
};

type CalendarTaskChecklistProps = {
  tasks: CalendarTaskChecklistItem[];
};

export function CalendarTaskChecklist({ tasks }: CalendarTaskChecklistProps) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markDone(taskId: string) {
    const task = items.find((item) => item.id === taskId);
    if (!task) return;

    setSavingId(taskId);
    setError(null);

    const endpoint =
      task.source === 'assignment'
        ? `/api/courses/${task.courseId}/assignments/${task.sourceId}`
        : task.source === 'quest'
          ? `/api/quests/${task.sourceId}`
          : `/api/groups/${task.groupId}/tasks/${task.sourceId}`;

    try {
      const response = await fetch(endpoint, {
        method: task.source === 'group_task' ? 'PATCH' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: task.source === 'group_task' ? 'DONE' : 'done',
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Unable to update the task');
        return;
      }

      setItems((current) => current.filter((item) => item.id !== taskId));
      router.refresh();
    } catch {
      setError('Network error while updating the task');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Calendar tasks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upcoming planner items from your calendar. Check them off as you
            finish them.
          </p>
        </div>
        <Link
          href="/dashboard/calendar"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Open calendar
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
          No upcoming calendar tasks in the next two weeks.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((task) => {
            const dueDate = new Date(task.dueAt);
            return (
              <label
                key={task.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-brand-200"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => markDone(task.id)}
                  disabled={savingId === task.id}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="truncate font-medium text-slate-900">
                      {task.title}
                    </p>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {task.source}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCalendarDate(dueDate)} at{' '}
                    {formatCalendarTime(dueDate)}
                    {task.meta ? ` · ${task.meta}` : ''}
                  </p>
                </div>
                <Link
                  href={task.href}
                  className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open
                </Link>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
