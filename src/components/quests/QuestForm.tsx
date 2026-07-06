'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { StatusBadge } from '@/components/assignments/StatusBadge';
import {
  DEFAULT_QUEST_DIFFICULTY,
  DEFAULT_QUEST_STATUS,
  QUEST_DIFFICULTIES,
  QUEST_STATUSES,
  QUEST_XP_BY_DIFFICULTY,
} from '@/lib/constants';
import { difficultyLabel, toDatetimeLocalValue } from '@/lib/format';

type QuestFormProps =
  | {
      mode: 'create';
      questId?: never;
      initialValues?: never;
      cancelHref: string;
      successHref: string;
    }
  | {
      mode: 'edit';
      questId: string;
      initialValues: {
        title: string;
        description: string | null;
        dueAt: Date | string | null;
        status: string;
        difficulty: string;
        xpReward: number;
        estimatedMinutes: number | null;
      };
      cancelHref: string;
      successHref: string;
    };

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function QuestForm(props: QuestFormProps) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const [title, setTitle] = useState(isEdit ? props.initialValues.title : '');
  const [description, setDescription] = useState(
    isEdit ? (props.initialValues.description ?? '') : ''
  );
  const [dueAt, setDueAt] = useState(
    isEdit ? toDatetimeLocalValue(props.initialValues.dueAt) : ''
  );
  const [status, setStatus] = useState(
    isEdit ? props.initialValues.status : DEFAULT_QUEST_STATUS
  );
  const [difficulty, setDifficulty] = useState(
    isEdit
      ? props.initialValues.difficulty || DEFAULT_QUEST_DIFFICULTY
      : DEFAULT_QUEST_DIFFICULTY
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    isEdit && props.initialValues.estimatedMinutes !== null
      ? String(props.initialValues.estimatedMinutes)
      : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const xpReward = QUEST_XP_BY_DIFFICULTY[difficulty] ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      status,
      difficulty,
      estimatedMinutes,
    };

    try {
      const url =
        props.mode === 'edit' ? `/api/quests/${props.questId}` : '/api/quests';
      const method = props.mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = 'Something went wrong';

        try {
          const data = JSON.parse(raw) as { error?: string };
          message = data.error ?? message;
        } catch {
          if (raw.trim()) {
            message = raw.trim().slice(0, 200);
          }
        }

        setError(message);
        return;
      }

      router.push(props.successHref);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-lg p-6">
      <div className="space-y-5">
        <div>
          <label
            htmlFor="quest-title"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Goal
          </label>
          <input
            id="quest-title"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Review chapter 5 flashcards"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="quest-description"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Details{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="quest-description"
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should you finish or review?"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="quest-due"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Due date{' '}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="quest-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="quest-status"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Status
            </label>
            <select
              id="quest-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {QUEST_STATUSES.map((questStatus) => (
                <option key={questStatus.value} value={questStatus.value}>
                  {questStatus.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="quest-difficulty"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Difficulty
            </label>
            <select
              id="quest-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={inputClass}
            >
              {QUEST_DIFFICULTIES.map((questDifficulty) => (
                <option
                  key={questDifficulty.value}
                  value={questDifficulty.value}
                >
                  {questDifficulty.label} ({questDifficulty.xpReward} XP)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="quest-estimated-minutes"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Estimated time{' '}
            <span className="font-normal text-slate-400">(minutes)</span>
          </label>
          <input
            id="quest-estimated-minutes"
            type="number"
            min={0}
            max={1440}
            step={5}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            placeholder="e.g. 45"
            className={inputClass}
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Current status: <StatusBadge status={status} />{' '}
          <span className="ml-2 font-medium text-brand-700">
            +{xpReward || 0} XP
          </span>
          <span className="ml-2 text-slate-500">
            {difficultyLabel(difficulty)} difficulty
          </span>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={props.cancelHref} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create quest'}
          </button>
        </div>
      </div>
    </form>
  );
}
