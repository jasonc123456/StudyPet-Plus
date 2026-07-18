'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  createFlashcardAction,
  deleteFlashcardAction,
  deleteFlashcardSetAction,
  updateFlashcardAction,
} from '@/app/actions/flashcard-actions';
import { Chip } from '@/components/common/Chip';
import { ConfirmDialog } from '@/components/courses/ConfirmDialog';

export type FlashcardSetItem = {
  id: string;
  topic: string;
  front: string;
  back: string;
};

export type FlashcardSetData = {
  id: string;
  title: string;
  course: { id: string; name: string; color: string } | null;
  cards: FlashcardSetItem[];
  topics: string[];
  sourceNotes: { id: string; title: string }[];
};

type FlashcardSetCardProps = {
  set: FlashcardSetData;
};

const emptyDraft = { topic: '', front: '', back: '' };

export function FlashcardSetCard({ set }: FlashcardSetCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [deleteSetOpen, setDeleteSetOpen] = useState(false);

  function refresh() {
    router.refresh();
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createFlashcardAction({
        setId: set.id,
        topic: draft.topic,
        front: draft.front,
        back: draft.back,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(emptyDraft);
      refresh();
    });
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateFlashcardAction({
        id: editingId,
        topic: editDraft.topic,
        front: editDraft.front,
        back: editDraft.back,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      refresh();
    });
  }

  function confirmDeleteCard() {
    if (!deleteCardId) return;
    const id = deleteCardId;
    setDeleteCardId(null);
    setError(null);
    startTransition(async () => {
      const result = await deleteFlashcardAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  function confirmDeleteSet() {
    setDeleteSetOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await deleteFlashcardSetAction(set.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refresh();
    });
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{set.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {set.course && (
              <Chip color={set.course.color}>{set.course.name}</Chip>
            )}
            {set.sourceNotes.map((note) => (
              <Chip key={note.id}>{note.title}</Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {set.topics.length === 0 ? (
              <span className="theme-muted text-xs">No topics yet</span>
            ) : (
              set.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  {topic}
                </span>
              ))
            )}
          </div>
          <p className="theme-muted mt-2 text-xs">
            {set.cards.length} card{set.cards.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/flashcards/study/${set.id}`}
            className="btn-primary text-sm"
          >
            Study
          </Link>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide cards' : 'Manage'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50"
            onClick={() => setDeleteSetOpen(true)}
            disabled={isPending}
          >
            Delete set
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 py-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {set.cards.length === 0 ? (
            <p className="text-sm text-slate-500">
              No cards in this set. Add one below.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {set.cards.map((card) => (
                <li
                  key={card.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  {editingId === card.id ? (
                    <form
                      onSubmit={handleSaveEdit}
                      className="flex flex-col gap-2"
                    >
                      <input
                        value={editDraft.topic}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, topic: e.target.value }))
                        }
                        placeholder="Topic"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                        maxLength={80}
                      />
                      <input
                        value={editDraft.front}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, front: e.target.value }))
                        }
                        placeholder="Front / question"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                        maxLength={500}
                      />
                      <textarea
                        value={editDraft.back}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, back: e.target.value }))
                        }
                        placeholder="Back / answer"
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        required
                        maxLength={1000}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="btn-primary text-sm"
                          disabled={isPending}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                          {card.topic}
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {card.front}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {card.back}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => {
                            setEditingId(card.id);
                            setEditDraft({
                              topic: card.topic,
                              front: card.front,
                              back: card.back,
                            });
                          }}
                          disabled={isPending}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteCardId(card.id)}
                          disabled={isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={handleAdd}
            className="rounded-lg border border-dashed border-slate-300 p-3"
          >
            <p className="mb-2 text-sm font-medium text-slate-700">
              Add a card
            </p>
            <div className="flex flex-col gap-2">
              <input
                value={draft.topic}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, topic: e.target.value }))
                }
                placeholder="Topic"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
                maxLength={80}
                disabled={isPending}
              />
              <input
                value={draft.front}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, front: e.target.value }))
                }
                placeholder="Front / question"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
                maxLength={500}
                disabled={isPending}
              />
              <textarea
                value={draft.back}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, back: e.target.value }))
                }
                placeholder="Back / answer"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
                maxLength={1000}
                disabled={isPending}
              />
              <button
                type="submit"
                className="btn-secondary self-start text-sm"
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Add card'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteCardId)}
        title="Delete flashcard?"
        message="This card will be permanently removed from the set."
        confirmLabel="Delete card"
        loading={isPending}
        onConfirm={confirmDeleteCard}
        onCancel={() => setDeleteCardId(null)}
      />

      <ConfirmDialog
        open={deleteSetOpen}
        title="Delete flashcard set?"
        message={`Delete “${set.title}” and all ${set.cards.length} card${
          set.cards.length === 1 ? '' : 's'
        }? Your source notes are kept. This cannot be undone.`}
        confirmLabel="Delete deck"
        loading={isPending}
        onConfirm={confirmDeleteSet}
        onCancel={() => setDeleteSetOpen(false)}
      />
    </article>
  );
}
