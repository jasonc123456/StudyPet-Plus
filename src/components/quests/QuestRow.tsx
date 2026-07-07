'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/courses/ConfirmDialog';
import { DueDate } from '@/components/DueDate';
import { DEFAULT_QUEST_DIFFICULTY, QUEST_STATUSES } from '@/lib/constants';
import { difficultyLabel, formatEstimatedTime } from '@/lib/format';

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

function useQuestRowState(quest: QuestRowData) {
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

  return {
    status,
    savingStatus,
    confirmOpen,
    deleting,
    error,
    editHref,
    setConfirmOpen,
    handleStatusChange,
    handleDelete,
  };
}

function QuestStatusSelect({
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
    <select
      aria-label={`Change status for ${title}`}
      value={status}
      onChange={(e) => onChange(e.target.value)}
      disabled={savingStatus}
      className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {QUEST_STATUSES.map((questStatus) => (
        <option key={questStatus.value} value={questStatus.value}>
          {questStatus.label}
        </option>
      ))}
    </select>
  );
}

function QuestRowActions({
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

function QuestDeleteDialog({
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
      title="Delete quest?"
      message={`"${title}" will be permanently removed.`}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function QuestMobileCard({ quest }: QuestRowProps) {
  const {
    status,
    savingStatus,
    confirmOpen,
    deleting,
    error,
    editHref,
    setConfirmOpen,
    handleStatusChange,
    handleDelete,
  } = useQuestRowState(quest);

  return (
    <>
      <div className="card p-4">
        <Link
          href={editHref}
          className="font-medium text-slate-900 hover:text-brand-600"
        >
          {quest.title}
        </Link>

        {quest.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {quest.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-brand-700">
            +{quest.xpReward} XP
          </span>
          <span className="text-slate-500">
            Due <DueDate dueAt={quest.dueAt} />
          </span>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">
            {difficultyLabel(quest.difficulty || DEFAULT_QUEST_DIFFICULTY)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            {formatEstimatedTime(quest.estimatedMinutes)}
          </span>
        </div>

        <div className="mt-3">
          <QuestStatusSelect
            title={quest.title}
            status={status}
            savingStatus={savingStatus}
            onChange={handleStatusChange}
          />
        </div>

        <div className="mt-3">
          <QuestRowActions
            editHref={editHref}
            onDelete={() => setConfirmOpen(true)}
            fullWidth
          />
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <QuestDeleteDialog
        open={confirmOpen}
        title={quest.title}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export function QuestRow({ quest }: QuestRowProps) {
  const {
    status,
    savingStatus,
    confirmOpen,
    deleting,
    error,
    editHref,
    setConfirmOpen,
    handleStatusChange,
    handleDelete,
  } = useQuestRowState(quest);

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
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
        <td className="px-2 py-2.5 text-sm font-semibold text-brand-700 sm:px-4 sm:py-3">
          +{quest.xpReward} XP
        </td>
        <td className="px-2 py-2.5 text-sm text-slate-600 sm:px-4 sm:py-3">
          <DueDate dueAt={quest.dueAt} />
        </td>
        <td className="px-2 py-2.5 sm:px-4 sm:py-3">
          <QuestStatusSelect
            title={quest.title}
            status={status}
            savingStatus={savingStatus}
            onChange={handleStatusChange}
          />
        </td>
        <td className="px-2 py-2.5 text-right sm:px-4 sm:py-3">
          <QuestRowActions
            editHref={editHref}
            onDelete={() => setConfirmOpen(true)}
          />
        </td>
      </tr>

      <QuestDeleteDialog
        open={confirmOpen}
        title={quest.title}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
