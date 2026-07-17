'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type FormEvent } from 'react';

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

type PastePayload = {
  mode: 'paste';
  content: string;
  title: string;
  count: number;
};

type NotePayload = {
  mode: 'note';
  noteId: string;
  count: number;
  replaceGenerated: boolean;
};

type LastPayload = PastePayload | NotePayload;

type GenerateResult =
  | { ok: true; provider: string; generatedCount: number }
  | { ok: false; error: string };

const DEFAULT_COUNT = 10;
const MIN_COUNT = 1;
const MAX_COUNT = 20;
const EMPTY_PASTE_ERROR = 'Paste some notes before generating flashcards.';
const HELPER_TEXT_PASTE =
  'Paste notes below to create a new note and generate cards.';
const HELPER_TEXT_NOTE = 'Generating from the selected saved note content.';

function clampCardCount(raw: number): number {
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(raw)));
}

function parseCardCountInput(rawValue: string): number | null {
  const next = Number(rawValue);
  if (!Number.isFinite(next)) {
    return null;
  }
  return clampCardCount(next);
}

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

function noteOptionLabel(note: NoteOption): string {
  const cardCount = note.cardCount ?? 0;
  if (cardCount > 0) {
    return `${note.title} (${cardCount} cards)`;
  }
  return note.title;
}

function noteHasCards(note: NoteOption | null): boolean {
  return (note?.cardCount ?? 0) > 0;
}

function helperTextFor(usingExistingNote: boolean): string {
  if (usingExistingNote) {
    return HELPER_TEXT_NOTE;
  }
  return HELPER_TEXT_PASTE;
}

function buildPastePayload(
  content: string,
  title: string,
  count: number
): PastePayload | { error: string } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { error: EMPTY_PASTE_ERROR };
  }
  return {
    mode: 'paste',
    content: trimmed,
    title: title.trim(),
    count,
  };
}

function buildNotePayload(
  noteId: string,
  count: number,
  replaceGenerated: boolean,
  selectedHasCards: boolean
): NotePayload {
  return {
    mode: 'note',
    noteId,
    count,
    replaceGenerated: selectedHasCards ? replaceGenerated : false,
  };
}

function resolveSubmitPayload(input: {
  noteId: string;
  content: string;
  title: string;
  count: number;
  replaceGenerated: boolean;
  selectedHasCards: boolean;
}): LastPayload | { error: string } {
  if (input.noteId) {
    return buildNotePayload(
      input.noteId,
      input.count,
      input.replaceGenerated,
      input.selectedHasCards
    );
  }
  return buildPastePayload(input.content, input.title, input.count);
}

async function requestFlashcards(
  payload: LastPayload
): Promise<GenerateResult> {
  if (payload.mode === 'paste') {
    return createFlashcardsFromPasteAction({
      content: payload.content,
      title: payload.title || undefined,
      count: payload.count,
    });
  }

  return generateFlashcardsAction(
    payload.noteId,
    payload.count,
    payload.replaceGenerated
  );
}

function shouldShowRetry(
  error: string | null,
  lastPayload: LastPayload | null,
  isPending: boolean
): boolean {
  if (!error) return false;
  if (!lastPayload) return false;
  if (isPending) return false;
  return true;
}

function CollapsedCreatePrompt({
  statusMessage,
  onExpand,
}: {
  statusMessage: string | null;
  onExpand: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {statusMessage ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {statusMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600">
          Study your sets below, or create another set from notes.
        </p>
        <button type="button" className="btn-primary" onClick={onExpand}>
          New set
        </button>
      </div>
    </div>
  );
}

function ExistingNoteSelect({
  notes,
  noteId,
  isPending,
  onNoteIdChange,
}: {
  notes: NoteOption[];
  noteId: string;
  isPending: boolean;
  onNoteIdChange: (nextNoteId: string) => void;
}) {
  const hasNoNotes = notes.length === 0;

  return (
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
        onChange={(e) => onNoteIdChange(e.target.value)}
      >
        <option value="">— Paste notes instead —</option>
        {hasNoNotes ? (
          <option value="" disabled>
            No saved notes yet
          </option>
        ) : (
          notes.map((note) => (
            <option key={note.id} value={note.id}>
              {noteOptionLabel(note)}
            </option>
          ))
        )}
      </select>
      {hasNoNotes ? (
        <p className="mt-1 text-xs text-slate-500">
          No saved notes yet. Paste text below or create a note first.
        </p>
      ) : null}
    </div>
  );
}

function PasteNoteFields({
  title,
  content,
  isPending,
  onTitleChange,
  onContentChange,
}: {
  title: string;
  content: string;
  isPending: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
}) {
  return (
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
          onChange={(e) => onTitleChange(e.target.value)}
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
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Paste or type study notes here. Topic-tagged flashcards will be generated from this text."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
    </>
  );
}

function ReplaceGeneratedOption({
  checked,
  isPending,
  onCheckedChange,
}: {
  checked: boolean;
  isPending: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={isPending}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span>
        Replace generated cards for this note (keeps cards you added manually).
      </span>
    </label>
  );
}

function GenerateSubmitButton({ isPending }: { isPending: boolean }) {
  if (isPending) {
    return (
      <button
        type="submit"
        className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        disabled
      >
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden
        />
        Generating…
      </button>
    );
  }

  return (
    <button
      type="submit"
      className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      Generate flashcards
    </button>
  );
}

function FormFeedback({
  error,
  statusMessage,
}: {
  error: string | null;
  statusMessage: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {error}
      </p>
    );
  }

  if (!statusMessage) {
    return null;
  }

  return (
    <p
      role="status"
      className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
    >
      {statusMessage}
    </p>
  );
}

function ModeFields({
  usingExistingNote,
  selectedHasCards,
  title,
  content,
  replaceGenerated,
  isPending,
  onTitleChange,
  onContentChange,
  onReplaceGeneratedChange,
}: {
  usingExistingNote: boolean;
  selectedHasCards: boolean;
  title: string;
  content: string;
  replaceGenerated: boolean;
  isPending: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onReplaceGeneratedChange: (checked: boolean) => void;
}) {
  if (!usingExistingNote) {
    return (
      <PasteNoteFields
        title={title}
        content={content}
        isPending={isPending}
        onTitleChange={onTitleChange}
        onContentChange={onContentChange}
      />
    );
  }

  if (!selectedHasCards) {
    return null;
  }

  return (
    <ReplaceGeneratedOption
      checked={replaceGenerated}
      isPending={isPending}
      onCheckedChange={onReplaceGeneratedChange}
    />
  );
}

type PanelController = ReturnType<typeof useCreateFlashcardsPanel>;

function useCreateFlashcardsPanel({
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
  const canCollapse = !defaultExpanded;

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === noteId) ?? null,
    [notes, noteId]
  );
  const selectedHasCards = noteHasCards(selectedNote);
  const helperText = helperTextFor(usingExistingNote);
  const showRetry = shouldShowRetry(error, lastPayload, isPending);

  function resetFormAfterSuccess() {
    setContent('');
    setTitle('');
    setNoteId('');
    setReplaceGenerated(false);
    setExpanded(false);
  }

  function runGenerate(payload: LastPayload) {
    if (isPending) return;

    setError(null);
    setStatusMessage(null);
    setLastPayload(payload);

    startTransition(async () => {
      const result = await requestFlashcards(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStatusMessage(
        providerSuccessLabel(result.provider, result.generatedCount)
      );
      resetFormAfterSuccess();
      onGenerated?.();
      router.refresh();
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const resolved = resolveSubmitPayload({
      noteId,
      content,
      title,
      count,
      replaceGenerated,
      selectedHasCards,
    });

    if ('error' in resolved) {
      setError(resolved.error);
      return;
    }

    runGenerate(resolved);
  }

  function handleNoteIdChange(nextNoteId: string) {
    setNoteId(nextNoteId);
    setReplaceGenerated(false);
    setError(null);
  }

  function handleContentChange(value: string) {
    setContent(value);
    setError(null);
  }

  function handleCountChange(rawValue: string) {
    const parsed = parseCardCountInput(rawValue);
    if (parsed === null) return;
    setCount(parsed);
  }

  function handleExpand() {
    setExpanded(true);
    setStatusMessage(null);
  }

  function handleCollapse() {
    setExpanded(false);
  }

  function handleRetry() {
    if (!lastPayload) return;
    runGenerate(lastPayload);
  }

  return {
    notes,
    expanded,
    content,
    title,
    noteId,
    count,
    replaceGenerated,
    error,
    statusMessage,
    isPending,
    usingExistingNote,
    canCollapse,
    selectedHasCards,
    helperText,
    showRetry,
    handleSubmit,
    handleNoteIdChange,
    handleContentChange,
    handleCountChange,
    handleExpand,
    handleCollapse,
    handleRetry,
    setTitle,
    setReplaceGenerated,
  };
}

function ExpandedCreateForm({
  notes,
  content,
  title,
  noteId,
  count,
  replaceGenerated,
  error,
  statusMessage,
  isPending,
  usingExistingNote,
  canCollapse,
  selectedHasCards,
  helperText,
  showRetry,
  handleSubmit,
  handleNoteIdChange,
  handleContentChange,
  handleCountChange,
  handleCollapse,
  handleRetry,
  setTitle,
  setReplaceGenerated,
}: PanelController) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Create flashcards
          </h2>
          <p className="mt-1 text-sm text-slate-500">{helperText}</p>
        </div>
        {canCollapse ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={handleCollapse}
            disabled={isPending}
          >
            Collapse
          </button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ExistingNoteSelect
          notes={notes}
          noteId={noteId}
          isPending={isPending}
          onNoteIdChange={handleNoteIdChange}
        />

        <ModeFields
          usingExistingNote={usingExistingNote}
          selectedHasCards={selectedHasCards}
          title={title}
          content={content}
          replaceGenerated={replaceGenerated}
          isPending={isPending}
          onTitleChange={setTitle}
          onContentChange={handleContentChange}
          onReplaceGeneratedChange={setReplaceGenerated}
        />

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
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={count}
              disabled={isPending}
              onChange={(e) => handleCountChange(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <GenerateSubmitButton isPending={isPending} />

          {showRetry ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRetry}
            >
              Retry
            </button>
          ) : null}
        </div>

        <FormFeedback error={error} statusMessage={statusMessage} />
      </form>
    </section>
  );
}

export function CreateFlashcardsPanel(props: CreateFlashcardsPanelProps) {
  const panel = useCreateFlashcardsPanel(props);

  if (!panel.expanded) {
    return (
      <CollapsedCreatePrompt
        statusMessage={panel.statusMessage}
        onExpand={panel.handleExpand}
      />
    );
  }

  return <ExpandedCreateForm {...panel} />;
}
