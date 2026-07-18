'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { QuizQuestionData } from '@/components/quizzes/types';

type QuizSessionProps = {
  quizId: string;
  noteTitle: string;
  questions: QuizQuestionData[];
  onExit: () => void;
};

type SubmitQuizAttemptResponse = {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  xpAwarded: number;
  weakTopic: string | null;
  error?: string;
};

export function QuizSession({
  quizId,
  noteTitle,
  questions,
  onExit,
}: QuizSessionProps) {
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({});
  const [attemptSynced, setAttemptSynced] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attemptSummary, setAttemptSummary] =
    useState<SubmitQuizAttemptResponse | null>(null);

  const total = questions.length;
  const current = questions[index];

  const scoreLabel = useMemo(
    () => `${correctCount}/${total} Correct`,
    [correctCount, total]
  );

  useEffect(() => {
    if (!finished || attemptSynced) return;

    let cancelled = false;

    void fetch('/api/quizzes/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId,
        answers: questions.map((question) => ({
          questionId: question.id,
          selectedIndex: selectedAnswers[question.id],
        })),
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as SubmitQuizAttemptResponse;
        if (!response.ok) {
          throw new Error(
            data.error ?? 'We could not save this quiz attempt just now.'
          );
        }

        if (!cancelled) {
          setAttemptSummary(data);
          setAttemptError(null);
          setAttemptSynced(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAttemptError(
            error instanceof Error
              ? error.message
              : 'We could not save this quiz attempt just now.'
          );
          setAttemptSynced(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attemptSynced, finished, quizId, questions, selectedAnswers]);

  const handleChoice = useCallback(
    (choiceIndex: number) => {
      if (revealed || !current) return;

      setSelectedIndex(choiceIndex);
      setSelectedAnswers((answers) => ({
        ...answers,
        [current.id]: choiceIndex,
      }));
      setRevealed(true);
      if (choiceIndex === current.correctIndex) {
        setCorrectCount((count) => count + 1);
      }
    },
    [current, revealed]
  );

  const handleNext = useCallback(() => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setSelectedIndex(null);
      setRevealed(false);
      return;
    }
    setFinished(true);
  }, [index, total]);

  if (total === 0 || !current) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">
          No questions in this quiz
        </p>
        <button type="button" className="btn-primary mt-4" onClick={onExit}>
          Back to quizzes
        </button>
      </div>
    );
  }

  if (finished) {
    const percent = Math.round((correctCount / total) * 100);
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <button
          type="button"
          onClick={onExit}
          className="self-start text-sm font-medium text-brand-600 hover:underline"
        >
          ← Back to quizzes
        </button>

        <div className="card px-6 py-8 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Quiz complete
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            {noteTitle}
          </h2>
          <p className="mt-4 text-4xl font-bold tabular-nums text-brand-600">
            {scoreLabel}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            You answered {percent}% of questions correctly.
          </p>
          {attemptSummary?.weakTopic ? (
            <p className="mt-3 text-sm text-slate-600">
              Review next:{' '}
              <span className="font-semibold text-slate-900">
                {attemptSummary.weakTopic}
              </span>
            </p>
          ) : null}
          {attemptSummary && attemptSummary.xpAwarded > 0 ? (
            <p className="mt-2 text-sm text-brand-600">
              +{attemptSummary.xpAwarded} XP added to your StudyPet
            </p>
          ) : null}
          {attemptSummary && attemptSummary.xpAwarded === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              You already earned XP for this quiz today.
            </p>
          ) : null}
          {attemptError ? (
            <p className="mt-3 text-sm text-red-700">{attemptError}</p>
          ) : null}
          <button type="button" className="btn-primary mt-6" onClick={onExit}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const isLast = index === total - 1;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onExit}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            ← Back to quizzes
          </button>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {noteTitle}
          </h1>
        </div>
        <p className="text-sm font-medium text-slate-500" aria-live="polite">
          Question {index + 1} / {total}
        </p>
      </div>

      <div className="card flex flex-col gap-5 p-6">
        <span className="w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
          {current.topic}
        </span>

        <p className="text-lg font-semibold leading-snug text-slate-900">
          {current.question}
        </p>

        <div
          className="flex flex-col gap-2"
          role="listbox"
          aria-label="Answer choices"
        >
          {current.choices.map((choice, choiceIndex) => {
            const isSelected = selectedIndex === choiceIndex;
            const isCorrect = choiceIndex === current.correctIndex;
            let choiceClass =
              'btn-secondary w-full justify-start px-4 py-3 text-left text-sm';

            if (revealed) {
              if (isCorrect) {
                choiceClass +=
                  ' border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300';
              } else if (isSelected) {
                choiceClass +=
                  ' border-red-300 bg-red-50 text-red-900 ring-2 ring-red-200';
              } else {
                choiceClass += ' opacity-60';
              }
            } else if (isSelected) {
              choiceClass += ' ring-2 ring-brand-300';
            }

            return (
              <button
                key={`${current.id}-${choiceIndex}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={revealed}
                onClick={() => handleChoice(choiceIndex)}
                className={choiceClass}
              >
                <span className="mr-2 font-semibold text-slate-500">
                  {String.fromCharCode(65 + choiceIndex)}.
                </span>
                {choice}
              </button>
            );
          })}
        </div>

        {revealed ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p
              className={`text-sm font-semibold ${
                selectedIndex === current.correctIndex
                  ? 'text-emerald-700'
                  : 'text-red-700'
              }`}
            >
              {selectedIndex === current.correctIndex
                ? 'Correct!'
                : 'Not quite — review the explanation below.'}
            </p>
            {current.explanation ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {current.explanation}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                The correct answer is{' '}
                <span className="font-medium">
                  {String.fromCharCode(65 + current.correctIndex)}.{' '}
                  {current.choices[current.correctIndex]}
                </span>
                .
              </p>
            )}
          </div>
        ) : null}

        {revealed ? (
          <button type="button" className="btn-primary" onClick={handleNext}>
            {isLast ? 'See results' : 'Next question'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
