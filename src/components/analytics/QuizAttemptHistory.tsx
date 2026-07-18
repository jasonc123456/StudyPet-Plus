import Link from 'next/link';

import { UpdatedAt } from '@/components/UpdatedAt';
import type { QuizAttemptHistoryItem } from '@/lib/quiz-analytics';

type QuizAttemptHistoryProps = {
  attempts: QuizAttemptHistoryItem[];
};

function scoreTone(scorePercent: number): string {
  if (scorePercent < 50) return 'text-red-700';
  if (scorePercent < 75) return 'text-amber-700';
  return 'text-emerald-700';
}

export function QuizAttemptHistory({ attempts }: QuizAttemptHistoryProps) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-800">
          No quizzes taken yet
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Your past quiz attempts and scores will appear here.
        </p>
        <Link
          href="/dashboard/quizzes"
          className="btn-primary mt-4 inline-flex"
        >
          Take a quiz
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Past quiz attempts">
      {attempts.map((attempt) => (
        <li
          key={attempt.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {attempt.courseColor ? (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: attempt.courseColor }}
                />
              ) : null}
              <span className="truncate text-sm font-semibold text-slate-900">
                {attempt.quizTitle}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {attempt.courseName ? `${attempt.courseName} · ` : ''}
              <UpdatedAt updatedAt={attempt.createdAt} />
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p
                className={`text-sm font-bold tabular-nums ${scoreTone(
                  attempt.scorePercent
                )}`}
              >
                {attempt.scorePercent}%
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {attempt.correctCount}/{attempt.totalQuestions}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
