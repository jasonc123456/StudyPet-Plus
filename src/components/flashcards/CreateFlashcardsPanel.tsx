'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type FormEvent } from 'react';

import { Chip } from '@/components/common/Chip';
import {
  CLASS_UNCATEGORIZED,
  ClassPicker,
  type ClassOption,
} from '@/components/common/ClassPicker';
import {
  GenerationProgress,
  useGenerationProgress,
} from '@/components/common/GenerationProgress';
import { consumeGenerationStream } from '@/lib/generation-stream';

export type FlashcardNoteOption = {
  id: string;
  title: string;
  hasContent: boolean;
  /** True when the note has an attached PDF passed through to the AI. */
  hasPdf: boolean;
  course: { id: string; name: string; color: string } | null;
};

type CreateFlashcardsPanelProps = {
  notes: FlashcardNoteOption[];
  defaultExpanded: boolean;
  onGenerated?: () => void;
};

type Tab = 'notes' | 'paste';

const DEFAULT_COUNT = 10;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

function clampCount(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(raw)));
}

function providerSuccessLabel(provider: string, count: number): string {
  const countLabel = `${count} flashcard${count === 1 ? '' : 's'}`;
  if (provider === 'local') return `Generated ${countLabel} with StudyPet+ AI.`;
  if (provider === 'gemini') return `Generated ${countLabel} with Gemini.`;
  if (provider === 'deepseek') return `Generated ${countLabel} with DeepSeek.`;
  if (provider === 'demo') {
    return `Saved ${countLabel} in demo mode. Set AI_DEMO_MODE=false for real cards.`;
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
  const [tab, setTab] = useState<Tab>('notes');
  const [classFilter, setClassFilter] = useState<string>(CLASS_UNCATEGORIZED);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const progress = useGenerationProgress();

  const notesWithContent = useMemo(
    () => notes.filter((note) => note.hasContent),
    [notes]
  );

  const courses = useMemo<ClassOption[]>(() => {
    const map = new Map<string, ClassOption>();
    for (const note of notes) {
      if (note.course) map.set(note.course.id, note.course);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  const visibleNotes = useMemo(() => {
    if (classFilter === CLASS_UNCATEGORIZED) {
      return notesWithContent.filter((note) => !note.course);
    }
    return notesWithContent.filter((note) => note.course?.id === classFilter);
  }, [notesWithContent, classFilter]);

  // A deck's notes must all belong to one class, so changing the class
  // clears any notes picked under the previous one.
  function handleClassChange(next: string) {
    setClassFilter(next);
    setSelectedNoteIds([]);
    setError(null);
  }

  const smartTitle = useMemo(() => {
    const selected = notes.filter((n) => selectedNoteIds.includes(n.id));
    if (selected.length === 0) return '';
    if (selected.length === 1) return selected[0]!.title;
    return `${selected[0]!.title} + ${selected.length - 1} more`;
  }, [notes, selectedNoteIds]);

  function toggleNote(noteId: string) {
    setSelectedNoteIds((ids) =>
      ids.includes(noteId)
        ? ids.filter((id) => id !== noteId)
        : [...ids, noteId]
    );
  }

  function resetAfterSuccess() {
    setSelectedNoteIds([]);
    setTitle('');
    setContent('');
    if (!defaultExpanded) setExpanded(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const body =
      tab === 'notes'
        ? {
            noteIds: selectedNoteIds,
            title: title.trim() || undefined,
            count,
          }
        : {
            content: content.trim(),
            title: title.trim() || undefined,
            count,
          };

    if (tab === 'notes' && selectedNoteIds.length === 0) {
      setError('Select at least one note.');
      return;
    }
    if (tab === 'paste' && !content.trim()) {
      setError('Paste some notes before generating flashcards.');
      return;
    }

    setError(null);
    setStatusMessage(null);
    progress.begin();

    startTransition(async () => {
      try {
        const result = await consumeGenerationStream<{
          provider: string;
          generatedCount: number;
          truncated?: boolean;
        }>('/api/flashcards/generate', body, progress.update);

        let message = providerSuccessLabel(
          result.provider,
          result.generatedCount
        );
        if (result.truncated) {
          message += ' Some source text was trimmed to fit.';
        }
        setStatusMessage(message);
        resetAfterSuccess();
        onGenerated?.();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to generate flashcards. Please try again.'
        );
      } finally {
        progress.end();
      }
    });
  }

  if (!expanded) {
    return (
      <div className="flex flex-col gap-3">
        {statusMessage ? (
          <p
            role="status"
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--success-soft)',
              color: 'var(--success)',
            }}
          >
            {statusMessage}
          </p>
        ) : null}
        <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="theme-muted text-sm">
            Study your decks below, or build another from notes.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setExpanded(true);
              setStatusMessage(null);
            }}
          >
            New deck
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Create a deck</h2>
          <p className="theme-muted mt-1 text-sm">
            Generate topic-tagged cards from your notes or pasted text.
          </p>
        </div>
        {!defaultExpanded ? (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => setExpanded(false)}
            disabled={isPending}
          >
            Collapse
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2">
        {(['notes', 'paste'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={
              t === tab ? 'btn-primary text-sm' : 'btn-secondary text-sm'
            }
            onClick={() => {
              setTab(t);
              setError(null);
            }}
          >
            {t === 'notes' ? 'From notes' : 'Paste text'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {tab === 'notes' ? (
          <>
            {courses.length > 0 && (
              <ClassPicker
                courses={courses}
                value={classFilter}
                onChange={handleClassChange}
                includeAll={false}
              />
            )}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Source notes</span>
              {visibleNotes.length === 0 ? (
                <p className="theme-muted text-sm">
                  No notes with content in this class.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {visibleNotes.map((note) => (
                    <label
                      key={note.id}
                      className="dashboard-row flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedNoteIds.includes(note.id)}
                        onChange={() => toggleNote(note.id)}
                        disabled={isPending}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {note.title}
                      </span>
                      {note.hasPdf && <Chip>PDF</Chip>}
                      {note.course && (
                        <Chip color={note.course.color}>
                          {note.course.name}
                        </Chip>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="flashcard-paste"
              className="mb-1 block text-sm font-medium"
            >
              Paste notes
            </label>
            <textarea
              id="flashcard-paste"
              rows={8}
              value={content}
              disabled={isPending}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or type study notes here."
              className="theme-input text-sm"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Title</span>
            <input
              type="text"
              maxLength={120}
              value={title}
              disabled={isPending}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={smartTitle || 'Deck title'}
              className="theme-input text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Number of cards</span>
            <input
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={count}
              disabled={isPending}
              onChange={(e) => setCount(clampCount(Number(e.target.value)))}
              className="theme-input text-sm"
            />
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary w-fit disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
        >
          {isPending ? 'Generating…' : 'Generate flashcards'}
        </button>

        <GenerationProgress state={progress.state} noun="flashcards" />

        {error ? (
          <p
            role="alert"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            {error}
          </p>
        ) : statusMessage ? (
          <p
            role="status"
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--success-soft)',
              color: 'var(--success)',
            }}
          >
            {statusMessage}
          </p>
        ) : null}
      </form>
    </section>
  );
}
