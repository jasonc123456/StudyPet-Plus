import Link from 'next/link';

import type { ReviewNextRecommendation } from '@/lib/review-next';

type ReviewNextCardProps = {
  recommendations: ReviewNextRecommendation[];
};

function typeLabel(type: ReviewNextRecommendation['type']) {
  return type === 'flashcards' ? 'Flashcards' : 'Quiz';
}

function typeBadgeClass(type: ReviewNextRecommendation['type']) {
  return type === 'flashcards'
    ? 'bg-violet-50 text-violet-700'
    : 'bg-sky-50 text-sky-700';
}

/**
 * US-4.04 — action-oriented “Review next” suggestions on Analytics.
 */
export function ReviewNextCard({ recommendations }: ReviewNextCardProps) {
  return (
    <section
      aria-labelledby="review-next-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="review-next-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Review next
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Personalized study actions ranked by weak topics and how long it has
            been since your last review.
          </p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-800">
            No recommendations yet
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Take a quiz or review flashcards to get personalized suggestions.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/quizzes" className="btn-primary text-sm">
              Take a quiz
            </Link>
            <Link
              href="/dashboard/flashcards"
              className="btn-secondary text-sm"
            >
              Open flashcards
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {recommendations.map((item, index) => (
            <li
              key={`${item.type}-${item.href}-${item.title}-${index}`}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadgeClass(item.type)}`}
                  >
                    {typeLabel(item.type)}
                  </span>
                  {index === 0 ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      Suggested first
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[item.topic, item.courseName].filter(Boolean).join(' · ') ||
                    'General study'}
                </p>
                <p className="mt-1.5 text-sm text-slate-600">{item.reason}</p>
              </div>
              <Link
                href={item.href}
                className="btn-primary shrink-0 px-4 py-2 text-sm"
              >
                {item.type === 'flashcards' ? 'Review deck' : 'Practice quiz'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
