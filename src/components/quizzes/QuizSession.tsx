'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ModeCard } from '@/components/common/ModeCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ResultRow } from '@/components/common/ResultRow';
import type { QuizMode, QuizQuestionData } from '@/components/quizzes/types';

type QuizSessionProps = {
  quizId: string;
  title: string;
  questions: QuizQuestionData[];
  onExit: () => void;
};

type SubmitQuizAttemptResponse = {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  xpAwarded: number;
  completed: boolean;
  weakTopic: string | null;
  error?: string;
};

type Phase = 'setup' | 'active' | 'results';

const MODE_META: Record<
  QuizMode,
  { icon: string; title: string; subtitle: string }
> = {
  review: {
    icon: '📖',
    title: 'Review',
    subtitle: 'Instant feedback and explanations, no timer.',
  },
  practice: {
    icon: '✏️',
    title: 'Practice',
    subtitle: 'Answer freely with hints and a soft timer.',
  },
  exam: {
    icon: '⏱️',
    title: 'Exam',
    subtitle: 'No hints, hard timer, graded at the end.',
  },
};

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export function QuizSession({
  quizId,
  title,
  questions,
  onExit,
}: QuizSessionProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [mode, setMode] = useState<QuizMode>('review');
  const [totalMinutes, setTotalMinutes] = useState('');

  // A run may cover every question (full attempt) or just the wrong ones
  // (Review Errors). Only full runs are submitted as graded attempts.
  const [runQuestions, setRunQuestions] =
    useState<QuizQuestionData[]>(questions);
  const [isFullRun, setIsFullRun] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState<number | null>(null);

  const [attemptSynced, setAttemptSynced] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attemptSummary, setAttemptSummary] =
    useState<SubmitQuizAttemptResponse | null>(null);
  const clientAttemptIdRef = useRef<string | null>(null);

  const total = runQuestions.length;
  const current = runQuestions[index];

  const perQuestionSeconds =
    totalSeconds && questions.length > 0
      ? Math.round(totalSeconds / questions.length)
      : null;
  const remaining = totalSeconds !== null ? totalSeconds - elapsed : null;
  const overtime =
    totalSeconds !== null && remaining !== null && remaining <= 0;

  const results = useMemo(
    () =>
      runQuestions.map((q) => {
        const selected = answers[q.id];
        return {
          question: q,
          selected,
          correct: selected === q.correctIndex,
        };
      }),
    [runQuestions, answers]
  );
  const correctCount = results.filter((r) => r.correct).length;
  const wrongQuestions = results
    .filter((r) => !r.correct)
    .map((r) => r.question);

  const startRun = useCallback(
    (runQs: QuizQuestionData[], fullRun: boolean) => {
      let seconds: number | null = null;
      const parsed = Number(totalMinutes);
      if (mode === 'exam') {
        seconds =
          totalMinutes.trim() && parsed > 0
            ? Math.round(parsed * 60)
            : questions.length * 60;
      } else if (mode === 'practice') {
        seconds =
          totalMinutes.trim() && parsed > 0 ? Math.round(parsed * 60) : null;
      }
      setTotalSeconds(seconds);
      setRunQuestions(runQs);
      setIsFullRun(fullRun);
      setIndex(0);
      setAnswers({});
      setRevealed(false);
      setShowHint(false);
      setElapsed(0);
      setAttemptSynced(false);
      setAttemptError(null);
      setAttemptSummary(null);
      clientAttemptIdRef.current = null;
      setPhase('active');
    },
    [mode, totalMinutes, questions.length]
  );

  const finish = useCallback(() => {
    setPhase('results');
  }, []);

  // Timer tick for Practice/Exam.
  useEffect(() => {
    if (phase !== 'active' || mode === 'review') return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, mode]);

  // Exam hard stop: auto-submit when the countdown hits zero.
  useEffect(() => {
    if (phase !== 'active' || mode !== 'exam' || totalSeconds === null) return;
    if (elapsed >= totalSeconds) finish();
  }, [elapsed, phase, mode, totalSeconds, finish]);

  // Submit a graded attempt once, only for full runs.
  useEffect(() => {
    if (phase !== 'results' || !isFullRun || attemptSynced) return;

    let cancelled = false;
    clientAttemptIdRef.current ??= globalThis.crypto.randomUUID();

    void fetch('/api/quizzes/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId,
        clientAttemptId: clientAttemptIdRef.current,
        answers: questions.map((q) => ({
          // Unanswered → an index past the choices: valid (>= 0) yet never
          // correct, so exam auto-submit and skipped questions grade as wrong.
          questionId: q.id,
          selectedIndex: answers[q.id] ?? q.choices.length,
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
      .catch((err: unknown) => {
        if (!cancelled) {
          setAttemptError(
            err instanceof Error
              ? err.message
              : 'We could not save this quiz attempt just now.'
          );
          setAttemptSynced(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase, isFullRun, attemptSynced, quizId, questions, answers]);

  const handleChoice = useCallback(
    (choiceIndex: number) => {
      if (!current) return;
      if (mode === 'review' && revealed) return;
      setAnswers((a) => ({ ...a, [current.id]: choiceIndex }));
      if (mode === 'review') setRevealed(true);
    },
    [current, mode, revealed]
  );

  const goTo = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setRevealed(false);
    setShowHint(false);
  }, []);

  // ---- Setup screen ---------------------------------------------------------
  if (phase === 'setup') {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <button
          type="button"
          onClick={onExit}
          className="self-start text-sm font-medium text-brand-600 hover:underline"
        >
          ← Back to quizzes
        </button>

        <div className="card flex flex-col gap-5 p-6">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="theme-muted mt-1 text-sm">
              {questions.length} question{questions.length === 1 ? '' : 's'} ·
              choose a mode to begin.
            </p>
          </div>

          <div className="grid gap-3">
            {(Object.keys(MODE_META) as QuizMode[]).map((m) => (
              <ModeCard
                key={m}
                icon={MODE_META[m].icon}
                title={MODE_META[m].title}
                subtitle={MODE_META[m].subtitle}
                selected={mode === m}
                onSelect={() => setMode(m)}
              />
            ))}
          </div>

          {mode !== 'review' && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                {mode === 'exam'
                  ? 'Time limit (minutes)'
                  : 'Soft timer (minutes)'}
              </span>
              <input
                type="number"
                min={1}
                value={totalMinutes}
                onChange={(e) => setTotalMinutes(e.target.value)}
                placeholder={
                  mode === 'exam'
                    ? `${questions.length} (default)`
                    : 'Optional — leave blank for unlimited'
                }
                className="theme-input text-sm"
              />
              <span className="theme-muted text-xs">
                {mode === 'exam'
                  ? 'Auto-submits when time runs out.'
                  : 'A gentle nudge — you can keep answering after time is up.'}
              </span>
            </label>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={() => startRun(questions, true)}
          >
            Start {MODE_META[mode].title.toLowerCase()}
          </button>
        </div>
      </div>
    );
  }

  if (total === 0 || !current) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="font-medium">No questions in this quiz</p>
        <button type="button" className="btn-primary mt-4" onClick={onExit}>
          Back to quizzes
        </button>
      </div>
    );
  }

  // ---- Results screen -------------------------------------------------------
  if (phase === 'results') {
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <button
          type="button"
          onClick={onExit}
          className="self-start text-sm font-medium text-brand-600 hover:underline"
        >
          ← Back to quizzes
        </button>

        <div className="card flex flex-col gap-4 px-6 py-6">
          <div className="text-center">
            <p className="theme-muted text-sm font-medium uppercase tracking-wide">
              {isFullRun ? 'Quiz complete' : 'Error review complete'}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{title}</h2>
            <p className="mt-3 text-4xl font-bold tabular-nums text-brand-600">
              {correctCount}/{total}
            </p>
            <p className="theme-muted mt-1 text-sm">{percent}% correct</p>
          </div>

          <ProgressBar value={correctCount} max={total} />

          {attemptSummary?.weakTopic ? (
            <p className="theme-muted text-center text-sm">
              Review next:{' '}
              <span className="font-semibold">{attemptSummary.weakTopic}</span>
            </p>
          ) : null}
          {attemptSummary && attemptSummary.xpAwarded > 0 ? (
            <p className="text-center text-sm text-brand-600">
              +{attemptSummary.xpAwarded} XP added to your StudyPet
            </p>
          ) : null}
          {attemptError ? (
            <p
              className="text-center text-sm"
              style={{ color: 'var(--danger)' }}
            >
              {attemptError}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => startRun(questions, true)}
            >
              Retry
            </button>
            {wrongQuestions.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => startRun(wrongQuestions, false)}
              >
                Review errors ({wrongQuestions.length})
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {results.map(({ question, selected, correct }) => (
            <ResultRow
              key={question.id}
              correct={correct}
              question={question.question}
              userAnswer={
                selected !== undefined && selected >= 0
                  ? question.choices[selected]
                  : 'No answer'
              }
              correctAnswer={question.choices[question.correctIndex]}
              explanation={question.explanation ?? undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  // ---- Active screen --------------------------------------------------------
  const isLast = index === total - 1;
  const answeredAll = runQuestions.every((q) => answers[q.id] !== undefined);
  const canAdvance = mode === 'review' ? revealed : true;

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
          <h1 className="mt-1 text-xl font-semibold">{title}</h1>
        </div>
        {totalSeconds !== null && (
          <div
            className="rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums"
            style={
              mode === 'exam' && remaining !== null && remaining <= 30
                ? { background: 'var(--danger-soft)', color: 'var(--danger)' }
                : { background: 'var(--btn-secondary-hover)' }
            }
            aria-live="polite"
          >
            {mode === 'exam'
              ? `⏱ ${formatClock(Math.max(0, remaining ?? 0))}`
              : `⏱ ${formatClock(elapsed)}${
                  totalSeconds ? ` / ${formatClock(totalSeconds)}` : ''
                }`}
          </div>
        )}
      </div>

      <ProgressBar value={index + 1} max={total} showCounter label="Progress" />

      {overtime && mode === 'practice' && (
        <div
          className="rounded-lg px-4 py-2 text-sm"
          style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}
        >
          Time&apos;s up — you can still finish at your own pace.
        </div>
      )}

      <div className="card flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <span
            className="w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {current.topic}
          </span>
          {perQuestionSeconds && mode === 'practice' && (
            <span className="theme-muted text-xs">
              ~{perQuestionSeconds}s/question
            </span>
          )}
        </div>

        <p className="text-lg font-semibold leading-snug">{current.question}</p>

        <div
          className="flex flex-col gap-2"
          role="listbox"
          aria-label="Answer choices"
        >
          {current.choices.map((choice, choiceIndex) => {
            const isSelected = answers[current.id] === choiceIndex;
            const isCorrect = choiceIndex === current.correctIndex;
            let choiceClass =
              'btn-secondary w-full justify-start px-4 py-3 text-left text-sm';

            if (mode === 'review' && revealed) {
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
                disabled={mode === 'review' && revealed}
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

        {/* Hint — available in Review + Practice, hidden in Exam. */}
        {mode !== 'exam' && current.hint ? (
          showHint ? (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'var(--warning-soft)',
                color: 'var(--warning)',
              }}
            >
              💡 {current.hint}
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary w-fit text-sm"
              onClick={() => setShowHint(true)}
            >
              Show hint
            </button>
          )
        ) : null}

        {/* Review-mode instant explanation. */}
        {mode === 'review' && revealed ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p
              className="text-sm font-semibold"
              style={{
                color:
                  answers[current.id] === current.correctIndex
                    ? 'var(--success)'
                    : 'var(--danger)',
              }}
            >
              {answers[current.id] === current.correctIndex
                ? 'Correct!'
                : 'Not quite — see the explanation below.'}
            </p>
            <p className="theme-muted mt-2 text-sm leading-relaxed">
              {current.explanation ??
                `The correct answer is ${String.fromCharCode(
                  65 + current.correctIndex
                )}. ${current.choices[current.correctIndex]}.`}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            Previous
          </button>

          {isLast ? (
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={
                mode === 'review'
                  ? !canAdvance
                  : mode === 'practice'
                    ? false
                    : !answeredAll
              }
              onClick={finish}
            >
              {mode === 'review' ? 'See results' : 'Submit'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={!canAdvance}
              onClick={() => goTo(index + 1)}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
