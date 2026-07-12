'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  createFlashcardsFromPasteAction,
  generateFlashcardsAction,
} from '@/app/actions/flashcard-actions';

export type NoteOption = {
  id: string;
  title: string;
  /** Existing flashcard count for this note (0 if none). */
  cardCount?: number;
};

type CreateFlashcardsPanelProps = {
  notes: NoteOption[];
  defaultExpanded: boolean;
  onGenerated?: () => void;
};

type LastPayload =
  | { mode: 'paste'; content: string; title: string; count: number }
  | {
      mode: 'note';
      noteId: string;
      count: number;
      replaceGenerated: boolean;
    };

const DEFAULT_COUNT = 10;

function providerSuccessLabel(provider: string, count: number): string {
  const countLabel = `${count} flashcard${count === 1 ? '' : 's'}`;
  if (provider === 'gemini') {
    return `Generated ${countLabel} with Gemini.`;
  }
  if (provider === 'deepseek') {
    return `Generated ${countLabel} with DeepSeek.`;
  }
  if (provider === 'demo') {
    return `Saved ${countLabel} in demo mode (not AI). Set AI_DEMO_MODE=false and GEMINI_API_KEY for real cards.`;
  }
  return `Generated ${countLabel}.`;
}

export function CreateFlashcardsPanel({
  notes,
  defaultExpanded,
  onGenerated,
}: CreateFlashcardsPanelProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [noteId, setNoteId] = useState('');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [replaceGenerated, setReplaceGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<LastPayload | null>(null);
  const [isPending, startTransition] = useTransition();

  const usingExistingNote = Boolean(noteId);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === noteId) ?? null,
    [notes, noteId]
  );

  const selectedHasCards = (selectedNote?.cardCount ?? 0) > 0;

  const helperText = useMemo(() => {
    if (usingExistingNote) {
      return 'Generating from the selected saved note content.';
    }
    return 'Paste notes below to create a new note and generate cards.';
  }, [usingExistingNote]);

  function runGenerate(payload: LastPayload) {
    if (isPending) return;

    setError(null);
    setStatusMessage(null);
    setLastPayload(payload);

    startTransition(async () => {
      const result =
        payload.mode === 'paste'
          ? await createFlashcardsFromPasteAction({
              content: payload.content,
              title: payload.title || undefined,
              count: payload.count,
            })
          : await generateFlashcardsAction(
              payload.noteId,
              payload.count,
              payload.replaceGenerated
            );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStatusMessage(
        providerSuccessLabel(result.provider, result.generatedCount)
      );

      setContent('');
      setTitle('');
      setNoteId('');
      setReplaceGenerated(false);
      setExpanded(false);
      onGenerated?.();
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    if (noteId) {
      runGenerate({
        mode: 'note',
        noteId,
        count,
        replaceGenerated: selectedHasCards ? replaceGenerated : false,
      });
      return;
    }

    if (!content.trim()) {
      setError('Paste some notes before generating flashcards.');
      return;
    }

    runGenerate({
      mode: 'paste',
      content: content.trim(),
      title: title.trim(),
      count,
    });
  }

  if (!expanded) {
    return (
      <div className="flex flex-col gap-3">
        {statusMessage && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-slate-600">
            Study your sets below, or create another set from notes.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setExpanded(true);
              setStatusMessage(null);
            }}
          >
            New set
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Create flashcards
          </h2>
          <p className="mt-1 text-sm text-slate-500">{helperText}</p>
        </div>
        {!defaultExpanded && (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setExpanded(false)}
            disabled={isPending}
          >
            Collapse
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="flashcard-existing-note"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Generate from existing saved note (optional)
          </label>
          <select
            id="flashcard-existing-note"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            value={noteId}
            disabled={isPending}
            onChange={(e) => {
              setNoteId(e.target.value);
              setReplaceGenerated(false);
              setError(null);
            }}
          >
            <option value="">— Paste notes instead —</option>
            {notes.length === 0 ? (
              <option value="" disabled>
                No saved notes yet
              </option>
            ) : (
              notes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title}
                  {(note.cardCount ?? 0) > 0
                    ? ` (${note.cardCount} cards)`
                    : ''}
                </option>
              ))
            )}
          </select>
          {notes.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No saved notes yet. Paste text below or create a note first.
            </p>
          )}
        </div>

        {!usingExistingNote && (
          <>
            <div>
              <label
                htmlFor="flashcard-title"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Title (optional)
              </label>
              <input
                id="flashcard-title"
                type="text"
                maxLength={200}
                value={title}
                disabled={isPending}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Defaults to the first line of your notes"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="flashcard-paste"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Paste notes
              </label>
              <textarea
                id="flashcard-paste"
                rows={10}
                value={content}
                disabled={isPending}
                onChange={(e) => {
                  setContent(e.target.value);
                  setError(null);
                }}
                placeholder="Paste or type study notes here. Topic-tagged flashcards will be generated from this text."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </>
        )}

        {usingExistingNote && selectedHasCards && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={replaceGenerated}
              disabled={isPending}
              onChange={(e) => setReplaceGenerated(e.target.checked)}
            />
            <span>
              Replace generated cards for this note (keeps cards you added
              manually).
            </span>
          </label>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="flashcard-count"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Number of cards
            </label>
            <input
              id="flashcard-count"
              type="number"
              min={1}
              max={20}
              value={count}
              disabled={isPending}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setCount(Math.min(20, Math.max(1, Math.trunc(next))));
              }}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <button
            type="submit"
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden
                />
                Generating…
              </>
            ) : (
              'Generate flashcards'
            )}
          </button>

          {error && lastPayload && !isPending && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => runGenerate(lastPayload)}
            >
              Retry
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {statusMessage && !error && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </p>
        )}
      </form>
    </section>
  );
}
