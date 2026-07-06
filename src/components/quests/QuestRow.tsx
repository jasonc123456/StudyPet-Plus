'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/courses/ConfirmDialog';
import { DEFAULT_QUEST_DIFFICULTY, QUEST_STATUSES } from '@/lib/constants';
import {
  difficultyLabel,
  formatDueDate,
  formatEstimatedTime,
} from '@/lib/format';

export type QuestRowData = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | string | null;
  status: string;
  difficulty: string;
  xpReward: number;
  estimatedMinutes: number | null;
};

type QuestRowProps = {
  quest: QuestRowData;
};

export function QuestRow({ quest }: QuestRowProps) {
  const router = useRouter();
  const [status, setStatus] = useState(quest.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editHref = `/dashboard/quests/${quest.id}/edit`;

  async function handleStatusChange(nextStatus: string) {
    const previousStatus = status;
    setStatus(nextStatus);
    setSavingStatus(true);
    setError(null);

    try {
      const res = await fetch(`/api/quests/${quest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = 'Failed to update status';

        try {
          const data = JSON.parse(raw) as { error?: string };
          message = data.error ?? message;
        } catch {
          if (raw.trim()) {
            message = raw.trim().slice(0, 200);
          }
        }

        setStatus(previousStatus);
        setError(message);
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
      const res = await fetch(`/api/quests/${quest.id}`, { method: 'DELETE' });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? 'Failed to delete quest');
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
            {quest.title}
          </Link>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">
              {difficultyLabel(quest.difficulty || DEFAULT_QUEST_DIFFICULTY)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              {formatEstimatedTime(quest.estimatedMinutes)}
            </span>
          </div>
          {quest.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {quest.description}
            </p>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-brand-700">
          +{quest.xpReward} XP
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">
          {formatDueDate(quest.dueAt)}
        </td>
        <td className="px-4 py-3">
          <select
            aria-label={`Change status for ${quest.title}`}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={savingStatus}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-wait disabled:opacity-70"
          >
            {QUEST_STATUSES.map((questStatus) => (
              <option key={questStatus.value} value={questStatus.value}>
                {questStatus.label}
              </option>
            ))}
          </select>
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
        title="Delete quest?"
        message={`"${quest.title}" will be permanently removed.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
