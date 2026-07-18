'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Chip } from '@/components/common/Chip';
import {
  CLASS_ALL,
  CLASS_UNCATEGORIZED,
  ClassPicker,
  type ClassOption,
} from '@/components/common/ClassPicker';
import {
  GenerationProgress,
  useGenerationProgress,
} from '@/components/common/GenerationProgress';
import { QuizSession } from '@/components/quizzes/QuizSession';
import type {
  ActiveQuizSession,
  QuizEntity,
  QuizNoteOption,
  QuizQuestionData,
} from '@/components/quizzes/types';
import { consumeGenerationStream } from '@/lib/generation-stream';

type QuizzesPageClientProps = {
  notes: QuizNoteOption[];
  quizzes: QuizEntity[];
};

type GenerateQuizResponse = {
  quiz?: { id: string; title?: string; questions: QuizQuestionData[] };
  generatedCount?: number;
  provider?: string;
  truncated?: boolean;
  error?: string;
};

const DEFAULT_COUNT = 8;
const MAX_COUNT = 50;

function scoreBadgeTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function toneStyle(tone: 'success' | 'warning' | 'danger') {
  const v = `var(--${tone})`;
  return {
    background: `color-mix(in srgb, ${v} 16%, var(--card-bg))`,
    color: v,
  };
}

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

export function QuizzesPageClient({ notes, quizzes }: QuizzesPageClientProps) {
  const router = useRouter();
  const [session, setSession] = useState<ActiveQuizSession | null>(null);
  const [classFilter, setClassFilter] = useState<string>(CLASS_ALL);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const progress = useGenerationProgress();

  const courses = useMemo<ClassOption[]>(() => {
    const map = new Map<string, ClassOption>();
    for (const note of notes) {
      if (note.course) map.set(note.course.id, note.course);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  const notesWithContent = useMemo(
    () => notes.filter((note) => note.hasContent),
    [notes]
  );

  const visibleNotes = useMemo(() => {
    if (classFilter === CLASS_ALL) return notesWithContent;
    if (classFilter === CLASS_UNCATEGORIZED) {
      return notesWithContent.filter((note) => !note.course);
    }
    return notesWithContent.filter((note) => note.course?.id === classFilter);
  }, [notesWithContent, classFilter]);

  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedNoteIds.includes(note.id)),
    [notes, selectedNoteIds]
  );

  const smartTitle = useMemo(() => {
    if (selectedNotes.length === 0) return '';
    if (selectedNotes.length === 1) return selectedNotes[0]!.title;
    return `${selectedNotes[0]!.title} + ${selectedNotes.length - 1} more`;
  }, [selectedNotes]);

  function toggleNote(noteId: string) {
    setSelectedNoteIds((ids) =>
      ids.includes(noteId)
        ? ids.filter((id) => id !== noteId)
        : [...ids, noteId]
    );
  }

  function startSession(quiz: {
    id: string;
    title: string;
    questions: QuizQuestionData[];
  }) {
    setSession({
      quizId: quiz.id,
      title: quiz.title,
      questions: quiz.questions,
    });
    setError(null);
    setStatusMessage(null);
  }

  function handleExitSession() {
    setSession(null);
    router.refresh();
  }

  async function handleDeleteQuiz(quiz: QuizEntity) {
    if (deletingQuizId) return;
    if (
      !window.confirm(
        `Delete “${quiz.title}”? This removes its questions and past attempts. This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingQuizId(quiz.id);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Failed to delete quiz');
      }
      setStatusMessage(`Deleted “${quiz.title}”.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete quiz');
    } finally {
      setDeletingQuizId(null);
    }
  }

  function handleGenerate() {
    if (selectedNoteIds.length === 0) {
      setError('Select at least one note to generate a quiz from.');
      return;
    }
    if (isPending) return;

    setError(null);
    setStatusMessage(null);
    progress.begin();

    const requestTitle = title.trim() || undefined;

    startTransition(async () => {
      try {
        const data = await consumeGenerationStream<GenerateQuizResponse>(
          '/api/quizzes/generate',
          { noteIds: selectedNoteIds, title: requestTitle, count },
          progress.update
        );

        const questions = data.quiz?.questions ?? [];
        if (questions.length === 0) {
          setError(
            'No quiz questions were returned. Try again or edit the notes.'
          );
          return;
        }

        let message = providerSuccessLabel(
          data.provider ?? 'unknown',
          data.generatedCount ?? questions.length
        );
        if (data.truncated) {
          message +=
            ' Note: the combined notes were long, so some text was trimmed.';
        }
        setStatusMessage(message);

        setSelectedNoteIds([]);
        setTitle('');
        startSession({
          id: data.quiz!.id,
          title: data.quiz!.title ?? requestTitle ?? smartTitle,
          questions,
        });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Network error while generating quiz. Please try again.'
        );
      } finally {
        progress.end();
      }
    });
  }

  if (session) {
    return (
      <QuizSession
        quizId={session.quizId}
        title={session.title}
        questions={session.questions}
        onExit={handleExitSession}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Generate a new quiz</h2>
          <p className="theme-muted mt-1 text-sm">
            Filter by class, pick one or more notes, then create a fresh
            multiple-choice quiz powered by AI.
          </p>
        </div>

        {courses.length > 0 && (
          <ClassPicker
            courses={courses}
            value={classFilter}
            onChange={setClassFilter}
          />
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Source notes</span>
          {visibleNotes.length === 0 ? (
            <p className="theme-muted text-sm">
              No notes with content in this class. Add note content first.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleNotes.map((note) => {
                const checked = selectedNoteIds.includes(note.id);
                return (
                  <label
                    key={note.id}
                    className="dashboard-row flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleNote(note.id)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {note.title}
                    </span>
                    {note.course && (
                      <Chip color={note.course.color}>{note.course.name}</Chip>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={smartTitle || 'Quiz title'}
              className="theme-input text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Questions</span>
            <input
              type="number"
              min={1}
              max={MAX_COUNT}
              value={count}
              onChange={(e) =>
                setCount(
                  Math.min(
                    MAX_COUNT,
                    Math.max(1, Number(e.target.value) || DEFAULT_COUNT)
                  )
                )
              }
              className="theme-input text-sm"
            />
          </label>
        </div>

        <button
          type="button"
          className="btn-primary w-fit"
          disabled={selectedNoteIds.length === 0 || isPending}
          onClick={handleGenerate}
        >
          {isPending
            ? 'Generating…'
            : selectedNoteIds.length > 1
              ? `Generate quiz from ${selectedNoteIds.length} notes`
              : 'Generate quiz'}
        </button>

        <GenerationProgress state={progress.state} noun="quiz questions" />
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
            background: 'var(--success-soft)',
            color: 'var(--success)',
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="theme-muted text-sm font-semibold uppercase tracking-wide">
          Your quizzes
        </h2>

        {quizzes.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-medium">No quizzes yet</p>
            <p className="theme-muted mt-1 text-sm">
              Pick some notes above to generate your first quiz.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {quizzes.map((quiz) => {
              const canTake = quiz.questions.length > 0;
              return (
                <li
                  key={quiz.id}
                  className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{quiz.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {quiz.course && (
                        <Chip color={quiz.course.color}>
                          {quiz.course.name}
                        </Chip>
                      )}
                      {quiz.sourceNotes.map((note) => (
                        <Chip key={note.id}>{note.title}</Chip>
                      ))}
                      <span className="theme-muted">
                        {quiz.questions.length} question
                        {quiz.questions.length === 1 ? '' : 's'}
                      </span>
                      {quiz.lastScorePercent !== null && (
                        <span
                          className="rounded-full px-2 py-0.5 font-semibold"
                          style={toneStyle(
                            scoreBadgeTone(quiz.lastScorePercent)
                          )}
                        >
                          Last score {quiz.lastScorePercent}%
                        </span>
                      )}
                      {quiz.attemptCount > 0 && (
                        <span className="theme-muted">
                          {quiz.attemptCount} attempt
                          {quiz.attemptCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {quiz.completed && (
                        <span
                          className="rounded-full px-2 py-0.5 font-semibold"
                          style={toneStyle('success')}
                        >
                          ✓ Done
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canTake && (
                      <button
                        type="button"
                        className="btn-primary px-3 py-2 text-sm"
                        onClick={() =>
                          startSession({
                            id: quiz.id,
                            title: quiz.title,
                            questions: quiz.questions,
                          })
                        }
                      >
                        {quiz.attemptCount > 0 ? 'Retake' : 'Take quiz'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
                      style={{
                        borderColor:
                          'color-mix(in srgb, var(--danger) 40%, transparent)',
                        color: 'var(--danger)',
                      }}
                      disabled={deletingQuizId === quiz.id}
                      onClick={() => handleDeleteQuiz(quiz)}
                    >
                      {deletingQuizId === quiz.id ? 'Deleting…' : 'Delete'}
                    </button>
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
