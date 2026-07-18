import Link from 'next/link';

import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import type { DashboardReviewNext } from '@/lib/dashboard';

type ReviewNextProps = {
  recommendation: DashboardReviewNext | null;
};

export function ReviewNext({ recommendation }: ReviewNextProps) {
  const incorrectSummary = recommendation
    ? `This topic has tripped you up ${recommendation.incorrectCount} time${
        recommendation.incorrectCount === 1 ? '' : 's'
      } across saved quiz attempts. Jump back into the matching study materials.`
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
          </>
        ) : (
          <>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              No weak topic yet
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Finish a few quizzes and StudyPet+ will suggest what to review
              next.
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
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard/notes/${recommendation.noteId}/edit`}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Review notes
            </Link>
            <Link
              href={`/dashboard/quizzes?noteId=${recommendation.noteId}&retake=latest`}
              className="btn-primary px-4 py-2 text-sm"
            >
              Retake quiz
            </Link>
            <Link
              href={`/dashboard/flashcards/study/${recommendation.noteId}`}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {recommendation.hasFlashcards
                ? 'Review flashcards'
                : 'Open flashcards'}
            </Link>
          </div>
        </>
      ) : null}
    </DashboardPanel>
  );
}
