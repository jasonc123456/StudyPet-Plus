// Quiz analytics + attempt history (US-4.02 / US-4.03).
//
// Aggregates the QuizAttempt / QuizQuestionResult rows written by
// `submitQuizAttempt` into two views the dashboard consumes:
//   * per-topic accuracy across every saved attempt (weak-topic analytics)
//   * a reverse-chronological list of past attempts (results history)
//
// Both queries are guarded against the "schema not migrated yet" errors
// (P2021/P2022) the same way the dashboard is, so an environment that hasn't
// applied the quiz migrations degrades to empty state instead of a 500.

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type TopicPerformance = {
  topic: string;
  correct: number;
  total: number;
  /** Whole-number percentage 0–100. */
  accuracy: number;
};

export type QuizAttemptHistoryItem = {
  id: string;
  quizId: string;
  noteId: string | null;
  noteTitle: string;
  courseName: string | null;
  courseColor: string | null;
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  createdAt: Date;
};

export type QuizAnalytics = {
  totalAttempts: number;
  totalQuestionsAnswered: number;
  /** Correct answers as a whole-number percentage of all answered questions. */
  overallAccuracy: number;
  /** Per-topic performance, weakest (lowest accuracy) first. */
  topics: TopicPerformance[];
  /** Most recent attempts first. */
  attempts: QuizAttemptHistoryItem[];
};

const EMPTY_ANALYTICS: QuizAnalytics = {
  totalAttempts: 0,
  totalQuestionsAnswered: 0,
  overallAccuracy: 0,
  topics: [],
  attempts: [],
};

function isMissingQuizSchema(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Loads per-topic accuracy and recent attempt history for a user.
 *
 * Topic accuracy is computed from every QuizQuestionResult the user has ever
 * recorded, so it aggregates across all quiz attempts (US-4.03). The history
 * list is capped to keep the page light; the aggregate stats are not.
 */
export async function getQuizAnalytics(
  userId: string,
  historyLimit = 20
): Promise<QuizAnalytics> {
  try {
    const [results, attempts, attemptCount] = await Promise.all([
      prisma.quizQuestionResult.findMany({
        where: { userId },
        select: {
          isCorrect: true,
          question: { select: { topic: true } },
        },
      }),
      prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: historyLimit,
        select: {
          id: true,
          quizId: true,
          correctCount: true,
          totalQuestions: true,
          scorePercent: true,
          createdAt: true,
          quiz: {
            select: {
              note: {
                select: {
                  id: true,
                  title: true,
                  course: { select: { name: true, color: true } },
                },
              },
            },
          },
        },
      }),
      prisma.quizAttempt.count({ where: { userId } }),
    ]);

    const topicTotals = new Map<string, { correct: number; total: number }>();
    let overallCorrect = 0;

    for (const result of results) {
      const topic = result.question.topic.trim() || 'Uncategorized';
      const bucket = topicTotals.get(topic) ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (result.isCorrect) {
        bucket.correct += 1;
        overallCorrect += 1;
      }
      topicTotals.set(topic, bucket);
    }

    const topics: TopicPerformance[] = [...topicTotals.entries()]
      .map(([topic, { correct, total }]) => ({
        topic,
        correct,
        total,
        accuracy: percent(correct, total),
      }))
      // Weakest first; ties broken by the larger sample (more evidence).
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);

    const history: QuizAttemptHistoryItem[] = attempts.map((attempt) => {
      const note = attempt.quiz.note;
      return {
        id: attempt.id,
        quizId: attempt.quizId,
        noteId: note?.id ?? null,
        noteTitle: note?.title ?? 'Untitled quiz',
        courseName: note?.course?.name ?? null,
        courseColor: note?.course?.color ?? null,
        correctCount: attempt.correctCount,
        totalQuestions: attempt.totalQuestions,
        scorePercent: attempt.scorePercent,
        createdAt: attempt.createdAt,
      };
    });

    return {
      totalAttempts: attemptCount,
      totalQuestionsAnswered: results.length,
      overallAccuracy: percent(overallCorrect, results.length),
      topics,
      attempts: history,
    };
  } catch (error) {
    if (isMissingQuizSchema(error)) {
      return EMPTY_ANALYTICS;
    }
    throw error;
  }
}
