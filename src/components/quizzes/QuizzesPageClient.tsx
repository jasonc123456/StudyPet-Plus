'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  GenerationProgress,
  useGenerationProgress,
} from '@/components/common/GenerationProgress';
import { QuizSession } from '@/components/quizzes/QuizSession';
import type {
  ActiveQuizSession,
  QuizNoteOption,
  QuizQuestionData,
} from '@/components/quizzes/types';
import { consumeGenerationStream } from '@/lib/generation-stream';

type QuizzesPageClientProps = {
  notes: QuizNoteOption[];
};

type GenerateQuizResponse = {
  quiz?: {
    id: string;
    questions: QuizQuestionData[];
  };
  generatedCount?: number;
  provider?: string;
  error?: string;
};

const DEFAULT_COUNT = 8;

function providerSuccessLabel(provider: string, count: number): string {
  const countLabel = `${count} question${count === 1 ? '' : 's'}`;
  if (provider === 'local') return `Generated ${countLabel} with StudyPet+ AI.`;
  if (provider === 'gemini') return `Generated ${countLabel} with Gemini.`;
  if (provider === 'deepseek') return `Generated ${countLabel} with DeepSeek.`;
  if (provider === 'demo') {
    return `Loaded ${countLabel} in demo mode. Set GEMINI_API_KEY for real quizzes.`;
  }
  return `Quiz ready — ${countLabel}.`;
}

export function QuizzesPageClient({ notes }: QuizzesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<ActiveQuizSession | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [replaceGenerated, setReplaceGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autoStartedRef = useRef(false);
  const progress = useGenerationProgress();

  const notesWithContent = useMemo(
    () => notes.filter((note) => note.hasContent),
    [notes]
  );

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId]
  );

  function startSession(
    noteId: string,
    quizId: string,
    noteTitle: string,
    questions: QuizQuestionData[]
  ) {
    setSession({ noteId, quizId, noteTitle, questions });
    setError(null);
    setStatusMessage(null);
  }

  function handleExitSession() {
    setSession(null);
    router.refresh();
  }

  function handleTakeExisting(note: QuizNoteOption) {
    const latestQuiz = note.latestQuiz;
    const questions = latestQuiz?.questions ?? [];
    if (questions.length === 0) {
      setError('This note does not have a saved quiz yet. Generate one first.');
      return;
    }
    startSession(note.id, latestQuiz!.id, note.title, questions);
  }

  function handleGenerate(note: QuizNoteOption) {
    if (!note.hasContent) {
      setError('Add content to this note before generating a quiz.');
      return;
    }
    if (isPending) return;

    setError(null);
    setStatusMessage(null);
    setPendingNoteId(note.id);
    progress.begin();

    startTransition(async () => {
      try {
        const data = await consumeGenerationStream<GenerateQuizResponse>(
          '/api/quizzes/generate',
          { noteId: note.id, count, replaceGenerated },
          progress.update
        );

        const questions = data.quiz?.questions ?? [];
        if (questions.length === 0) {
          setError(
            'No quiz questions were returned. Try again or edit the note.'
          );
          return;
        }

        setStatusMessage(
          providerSuccessLabel(
            data.provider ?? 'unknown',
            data.generatedCount ?? questions.length
          )
        );
        startSession(note.id, data.quiz!.id, note.title, questions);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Network error while generating quiz. Please try again.'
        );
      } finally {
        progress.end();
        setPendingNoteId(null);
      }
    });
  }

  useEffect(() => {
    if (autoStartedRef.current || session) return;

    const requestedNoteId = searchParams.get('noteId');
    const shouldRetake = searchParams.get('retake') === 'latest';
    if (!requestedNoteId || !shouldRetake) return;

    const note = notes.find((candidate) => candidate.id === requestedNoteId);
    if (!note?.latestQuiz?.questions.length) return;

    autoStartedRef.current = true;
    startSession(
      note.id,
      note.latestQuiz.id,
      note.title,
      note.latestQuiz.questions
    );
  }, [notes, searchParams, session]);

  if (session) {
    return (
      <QuizSession
        quizId={session.quizId}
        noteTitle={session.noteTitle}
        questions={session.questions}
        onExit={handleExitSession}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Generate from a note
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pick a saved note with study content, then create a fresh
            multiple-choice quiz powered by AI.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Note</span>
            <select
              value={selectedNoteId}
              onChange={(e) => setSelectedNoteId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Select a note…</option>
              {notesWithContent.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title}
                  {note.questionCount > 0
                    ? ` (${note.questionCount} saved)`
                    : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Questions</span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) =>
                setCount(
                  Math.min(
                    20,
                    Math.max(1, Number(e.target.value) || DEFAULT_COUNT)
                  )
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
        </div>

        {selectedNote && selectedNote.questionCount > 0 ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={replaceGenerated}
              onChange={(e) => setReplaceGenerated(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Replace previous quiz for this note
          </label>
        ) : null}

        <button
          type="button"
          className="btn-primary w-fit"
          disabled={!selectedNote || isPending}
          onClick={() => selectedNote && handleGenerate(selectedNote)}
        >
          {isPending && pendingNoteId === selectedNoteId
            ? 'Generating…'
            : 'Generate quiz'}
        </button>

        <GenerationProgress state={progress.state} noun="quiz questions" />
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {statusMessage}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your notes
        </h2>

        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-800">No notes yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a note with study content to generate your first quiz.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => {
              const isGenerating = isPending && pendingNoteId === note.id;
              const canGenerate = note.hasContent;
              const canTake = (note.latestQuiz?.questions.length ?? 0) > 0;

              return (
                <li
                  key={note.id}
                  className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {note.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {note.course ? (
                        <span
                          className="rounded-full px-2 py-0.5 font-medium"
                          style={{
                            backgroundColor: `${note.course.color}22`,
                            color: note.course.color,
                          }}
                        >
                          {note.course.name}
                        </span>
                      ) : (
                        <span>Uncategorized</span>
                      )}
                      {note.hasContent ? (
                        <span>Ready for quiz generation</span>
                      ) : (
                        <span className="text-amber-700">No note content</span>
                      )}
                      {note.questionCount > 0 ? (
                        <span>{note.questionCount} saved questions</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary px-3 py-2 text-sm"
                      disabled={!canGenerate || isPending}
                      onClick={() => handleGenerate(note)}
                    >
                      {isGenerating ? 'Generating…' : 'Generate quiz'}
                    </button>
                    {canTake ? (
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2 text-sm"
                        disabled={isPending}
                        onClick={() => handleTakeExisting(note)}
                      >
                        Take quiz
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
