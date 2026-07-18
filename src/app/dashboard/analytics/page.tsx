import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { QuizAttemptHistory } from '@/components/analytics/QuizAttemptHistory';
import { TopicPerformanceList } from '@/components/analytics/TopicPerformanceList';
import { PageHeader } from '@/components/courses/PageHeader';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { getQuizAnalytics } from '@/lib/quiz-analytics';

/**
 * Quiz analytics dashboard (US-4.02 results history + US-4.03 weak-topic
 * analytics). Aggregates every saved quiz attempt into per-topic accuracy and
 * a reverse-chronological attempt history so a student can see where they're
 * strong, where they're weak, and what they've already taken.
 */
export default async function DashboardAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const analytics = await getQuizAnalytics(session.user.id);
  const weakest = analytics.topics[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Per-topic accuracy across every quiz you've taken, plus your recent results."
        action={{ label: 'Take a quiz', href: '/dashboard/quizzes' }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardPanel>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Quizzes taken
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {analytics.totalAttempts}
          </p>
        </DashboardPanel>
        <DashboardPanel>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Overall accuracy
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {analytics.overallAccuracy}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {analytics.totalQuestionsAnswered} questions answered
          </p>
        </DashboardPanel>
        <DashboardPanel>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Weakest topic
          </p>
          {weakest ? (
            <>
              <p className="mt-2 truncate text-xl font-bold text-slate-900">
                {weakest.topic}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {weakest.accuracy}% correct — review this next
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              No data yet — take a quiz to find out.
            </p>
          )}
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="topic-performance-heading">
          <h2
            id="topic-performance-heading"
            className="mb-3 text-lg font-semibold text-slate-900"
          >
            Performance by topic
          </h2>
          <TopicPerformanceList topics={analytics.topics} />
        </section>

        <section aria-labelledby="attempt-history-heading">
          <h2
            id="attempt-history-heading"
            className="mb-3 text-lg font-semibold text-slate-900"
          >
            Recent quiz attempts
          </h2>
          <QuizAttemptHistory attempts={analytics.attempts} />
        </section>
      </div>
    </div>
  );
}
