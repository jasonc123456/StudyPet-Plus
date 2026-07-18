import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AnalyticsClassFilter } from '@/components/analytics/AnalyticsClassFilter';
import { QuizAttemptHistory } from '@/components/analytics/QuizAttemptHistory';
import { TopicPerformanceList } from '@/components/analytics/TopicPerformanceList';
import { StatTile } from '@/components/common/StatTile';
import { PageHeader } from '@/components/courses/PageHeader';
import { getQuizAnalytics } from '@/lib/quiz-analytics';

/**
 * Quiz analytics dashboard (US-4.02 results history + US-4.03 weak-topic
 * analytics), with a class filter plus flashcard-progress tiles. Aggregates
 * every saved quiz attempt into per-topic accuracy and a reverse-chronological
 * attempt history.
 */
export default async function DashboardAnalyticsPage({
  searchParams,
}: {
  searchParams: { course?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const courseId = searchParams.course || undefined;
  const analytics = await getQuizAnalytics(session.user.id, 20, courseId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Per-topic accuracy across your quizzes, your recent results, and study progress."
        action={{ label: 'Take a quiz', href: '/dashboard/quizzes' }}
      />

      {analytics.courses.length > 0 && (
        <AnalyticsClassFilter courses={analytics.courses} />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon="📝"
          value={analytics.totalAttempts}
          label="Quizzes taken"
        />
        <StatTile
          icon="🎯"
          value={`${analytics.overallAccuracy}%`}
          label="Overall accuracy"
          tone="success"
        />
        <StatTile
          icon="🃏"
          value={analytics.flashcardsDone}
          label="Flashcards done"
        />
        <StatTile
          icon="🔥"
          value={analytics.streak}
          label="Day streak"
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="topic-performance-heading">
          <h2
            id="topic-performance-heading"
            className="mb-3 text-lg font-semibold"
          >
            Performance by topic
          </h2>
          <TopicPerformanceList topics={analytics.topics} />
        </section>

        <section aria-labelledby="attempt-history-heading">
          <h2
            id="attempt-history-heading"
            className="mb-3 text-lg font-semibold"
          >
            Recent quiz attempts
          </h2>
          <QuizAttemptHistory attempts={analytics.attempts} />
        </section>
      </div>
    </div>
  );
}
