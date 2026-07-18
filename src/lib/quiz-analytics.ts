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
  quizTitle: string;
  courseName: string | null;
  courseColor: string | null;
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  createdAt: Date;
};

export type AnalyticsCourse = { id: string; name: string; color: string };

export type QuizAnalytics = {
  totalAttempts: number;
  totalQuestionsAnswered: number;
  /** Correct answers as a whole-number percentage of all answered questions. */
  overallAccuracy: number;
  /** Per-topic performance, weakest (lowest accuracy) first. */
  topics: TopicPerformance[];
  /** Most recent attempts first. */
  attempts: QuizAttemptHistoryItem[];
  /** Distinct courses among the user's quizzes, for the class filter. */
  courses: AnalyticsCourse[];
  /** Flashcards reviewed (one per card per day), all-time. */
  flashcardsDone: number;
  /** Current study-day streak. */
  streak: number;
};

const EMPTY_ANALYTICS: QuizAnalytics = {
  totalAttempts: 0,
  totalQuestionsAnswered: 0,
  overallAccuracy: 0,
  topics: [],
  attempts: [],
  courses: [],
  flashcardsDone: 0,
  streak: 0,
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
  historyLimit = 20,
  courseId?: string
): Promise<QuizAnalytics> {
  try {
    const attemptWhere = courseId ? { userId, quiz: { courseId } } : { userId };
    const resultWhere = courseId
      ? { userId, question: { quiz: { courseId } } }
      : { userId };

    const [results, attempts, attemptCount, courseRows, flashcardsDone, pet] =
      await Promise.all([
        prisma.quizQuestionResult.findMany({
          where: resultWhere,
          select: {
            isCorrect: true,
            question: { select: { topic: true } },
          },
        }),
        prisma.quizAttempt.findMany({
          where: attemptWhere,
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
                title: true,
                note: { select: { title: true } },
                course: { select: { name: true, color: true } },
              },
            },
          },
        }),
        prisma.quizAttempt.count({ where: attemptWhere }),
        prisma.quiz.findMany({
          where: { userId, courseId: { not: null } },
          distinct: ['courseId'],
          select: { course: { select: { id: true, name: true, color: true } } },
        }),
        prisma.flashcardReviewAward.count({ where: { userId } }),
        prisma.pet.findUnique({
          where: { userId },
          select: { streakCount: true },
        }),
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

    const history: QuizAttemptHistoryItem[] = attempts.map((attempt) => ({
      id: attempt.id,
      quizId: attempt.quizId,
      quizTitle:
        attempt.quiz.title ?? attempt.quiz.note?.title ?? 'Untitled quiz',
      courseName: attempt.quiz.course?.name ?? null,
      courseColor: attempt.quiz.course?.color ?? null,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      scorePercent: attempt.scorePercent,
      createdAt: attempt.createdAt,
    }));

    const courses: AnalyticsCourse[] = courseRows
      .map((row) => row.course)
      .filter((course): course is AnalyticsCourse => Boolean(course))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalAttempts: attemptCount,
      totalQuestionsAnswered: results.length,
      overallAccuracy: percent(overallCorrect, results.length),
      topics,
      attempts: history,
      courses,
      flashcardsDone,
      streak: pet?.streakCount ?? 0,
    };
  } catch (error) {
    if (isMissingQuizSchema(error)) {
      return EMPTY_ANALYTICS;
    }
    throw error;
  }
}
