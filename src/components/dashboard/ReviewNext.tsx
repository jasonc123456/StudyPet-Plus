import Link from 'next/link';

import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import type { DashboardReviewNext } from '@/lib/dashboard';

type ReviewNextProps = {
  recommendation: DashboardReviewNext | null;
};

function flashcardStudyHref(recommendation: DashboardReviewNext): string {
  return recommendation.flashcardSetId
    ? `/dashboard/flashcards/study/${recommendation.flashcardSetId}`
    : '/dashboard/flashcards';
}

export function ReviewNext({ recommendation }: ReviewNextProps) {
  const incorrectSummary = recommendation
    ? `This topic has tripped you up ${recommendation.incorrectCount} time${
        recommendation.incorrectCount === 1 ? '' : 's'
      } across saved quiz attempts.`
    : null;

  const primaryActionLabel = recommendation
    ? recommendation.recommendedAction === 'flashcards'
      ? `Review ${recommendation.flashcardCount} flashcard${
          recommendation.flashcardCount === 1 ? '' : 's'
        }`
      : recommendation.recommendedAction === 'notes'
        ? 'Read through the note'
        : 'Retake the quiz'
    : null;

  const primaryActionHref = recommendation
    ? recommendation.recommendedAction === 'flashcards'
      ? flashcardStudyHref(recommendation)
      : recommendation.recommendedAction === 'notes'
        ? `/dashboard/notes/${recommendation.noteId}`
        : `/dashboard/quizzes?noteId=${recommendation.noteId}&retake=latest`
    : null;

  return (
    <DashboardPanel className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Review next
        </p>
        {recommendation ? (
          <>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              {recommendation.topic}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{incorrectSummary}</p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Recommended first:{' '}
              <span className="text-brand-600">{primaryActionLabel}</span>
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              No weak topic yet
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              No recommendations yet. Take a quiz or review flashcards to get
              personalized suggestions.
            </p>
          </>
        )}
      </div>

      {recommendation ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">
              From note: {recommendation.noteTitle}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {recommendation.recommendationReason}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {primaryActionHref ? (
              <Link
                href={primaryActionHref}
                className="btn-primary px-4 py-2 text-sm"
              >
                {primaryActionLabel}
              </Link>
            ) : null}
            {recommendation.recommendedAction !== 'notes' ? (
              <Link
                href={`/dashboard/notes/${recommendation.noteId}`}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Review notes
              </Link>
            ) : null}
            {recommendation.recommendedAction !== 'quiz' ? (
              <Link
                href={`/dashboard/quizzes?noteId=${recommendation.noteId}&retake=latest`}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Retake quiz
              </Link>
            ) : null}
            {recommendation.recommendedAction !== 'flashcards' &&
            recommendation.flashcardCount > 0 ? (
              <Link
                href={flashcardStudyHref(recommendation)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Review flashcards
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </DashboardPanel>
  );
}
