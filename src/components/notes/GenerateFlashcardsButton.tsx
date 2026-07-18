'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { generateFlashcardsAction } from '@/app/actions/flashcard-actions';

export type FlashcardPreviewItem = {
  id: string;
  topic: string;
  front: string;
  back: string;
};

type GenerateFlashcardsButtonProps = {
  noteId: string;
  initialFlashcards: FlashcardPreviewItem[];
  /** When false, generation is disabled (e.g. empty saved note content). */
  hasContent: boolean;
};

function providerSuccessLabel(provider: string, count: number): string {
  const countLabel = `${count} flashcard${count === 1 ? '' : 's'}`;
  if (provider === 'local') {
    return `Generated ${countLabel} with StudyPet+ AI.`;
  }
  if (provider === 'gemini') {
    return `Generated ${countLabel} with Gemini.`;
  }
  if (provider === 'deepseek') {
    return `Generated ${countLabel} with DeepSeek.`;
  }
  if (provider === 'demo') {
    return `Saved ${countLabel} in demo mode (not AI).`;
  }
  return `Generated ${countLabel}.`;
}

export function GenerateFlashcardsButton({
  noteId,
  initialFlashcards,
  hasContent,
}: GenerateFlashcardsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [replaceGenerated, setReplaceGenerated] = useState(false);
  const [flashcards, setFlashcards] =
    useState<FlashcardPreviewItem[]>(initialFlashcards);

  function handleGenerate() {
    if (isPending || !hasContent) return;

    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await generateFlashcardsAction(
        noteId,
        undefined,
        flashcards.length > 0 ? replaceGenerated : false
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setFlashcards(result.flashcards);

      setSuccessMessage(
        providerSuccessLabel(result.provider, result.generatedCount)
      );
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            AI flashcards
          </h2>
          <p className="text-sm text-slate-500">
            Generate topic-tagged cards from this note&apos;s saved content.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleGenerate}
          disabled={isPending || !hasContent}
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
      </div>

      {flashcards.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={replaceGenerated}
            disabled={isPending}
            onChange={(e) => setReplaceGenerated(e.target.checked)}
          />
          <span>Replace generated cards (keeps cards you added manually).</span>
        </label>
      )}

      {!hasContent && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Add and save note content before generating flashcards.
        </p>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
          {!isPending && (
            <button
              type="button"
              className="btn-secondary self-start"
              onClick={handleGenerate}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {successMessage && !error && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {successMessage}
        </p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          Cards for this note
          {flashcards.length > 0 ? ` (${flashcards.length})` : ''}
        </h3>

        {flashcards.length === 0 ? (
          <p className="text-sm text-slate-500">
            No flashcards yet. Generate some to preview them here.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {flashcards.map((card) => (
              <li
                key={card.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {card.topic}
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {card.front}
                </p>
                <p className="mt-1 text-sm text-slate-600">{card.back}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
