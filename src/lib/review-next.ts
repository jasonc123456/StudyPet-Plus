// US-4.04 — “Review next” recommendation engine.
//
// Ranks concrete study actions (practice a quiz or review a flashcard deck)
// using weak-topic accuracy + how long ago the item was last practiced.
// Does not change quiz-taking, generation, or XP payout behavior.

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type ReviewNextType = 'flashcards' | 'quiz';

export type ReviewNextRecommendation = {
  type: ReviewNextType;
  title: string;
  topic: string | null;
  courseName: string | null;
  reason: string;
  href: string;
};

type TopicStats = {
  correct: number;
  total: number;
  accuracy: number;
  lastIncorrectAt: Date | null;
};

const MS_DAY = 86_400_000;

function isMissingSchema(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  );
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_DAY));
}

/** Higher = more overdue. Never reviewed outranks everything. */
function stalenessScore(lastActivity: Date | null, now: Date): number {
  if (!lastActivity) return 100;
  const days = daysSince(lastActivity, now) ?? 0;
  if (days <= 1) return 5;
  if (days <= 3) return 20;
  if (days <= 7) return 40;
  if (days <= 14) return 60;
  if (days <= 30) return 80;
  return 95;
}

/** Higher = weaker performance. Unknown topics get a mild bump. */
function weaknessScore(accuracy: number | null): number {
  if (accuracy === null) return 35;
  return Math.max(0, 100 - accuracy);
}

function pickWeakestTopic(
  topics: string[],
  topicStats: Map<string, TopicStats>
): { topic: string | null; accuracy: number | null } {
  let best: { topic: string; accuracy: number } | null = null;
  for (const raw of topics) {
    const topic = raw.trim() || 'Uncategorized';
    const stats = topicStats.get(topic);
    if (!stats || stats.total === 0) continue;
    if (!best || stats.accuracy < best.accuracy) {
      best = { topic, accuracy: stats.accuracy };
    }
  }
  return best
    ? { topic: best.topic, accuracy: best.accuracy }
    : { topic: topics[0]?.trim() || null, accuracy: null };
}

function formatStalenessReason(lastActivity: Date | null, now: Date): string {
  if (!lastActivity) return 'Never reviewed';
  const days = daysSince(lastActivity, now) ?? 0;
  if (days <= 1) return 'Reviewed recently';
  if (days === 1) return 'Last reviewed yesterday';
  return `Last reviewed ${days} days ago`;
}

type ScoredRecommendation = ReviewNextRecommendation & { score: number };

/**
 * Build ranked “Review next” suggestions for the analytics page (and similar).
 */
export async function getReviewNextRecommendations(
  userId: string,
  options: { courseId?: string; limit?: number } = {}
): Promise<ReviewNextRecommendation[]> {
  const limit = Math.min(Math.max(options.limit ?? 3, 1), 5);
  const courseId = options.courseId;
  const now = new Date();

  try {
    const quizWhere = courseId ? { userId, courseId } : { userId };
    const setWhere = courseId ? { userId, courseId } : { userId };
    const resultWhere = courseId
      ? { userId, question: { quiz: { courseId } } }
      : { userId };

    const [results, quizzes, sets] = await Promise.all([
      prisma.quizQuestionResult.findMany({
        where: resultWhere,
        select: {
          isCorrect: true,
          createdAt: true,
          question: { select: { topic: true } },
        },
      }),
      prisma.quiz.findMany({
        where: quizWhere,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          course: { select: { name: true } },
          note: { select: { title: true } },
          questions: { select: { topic: true } },
          attempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, scorePercent: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
      prisma.flashcardSet.findMany({
        where: setWhere,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          course: { select: { name: true } },
          cards: {
            select: {
              id: true,
              topic: true,
              reviewAwards: {
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { createdAt: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
    ]);

    const topicStats = new Map<string, TopicStats>();
    for (const result of results) {
      const topic = result.question.topic.trim() || 'Uncategorized';
      const bucket = topicStats.get(topic) ?? {
        correct: 0,
        total: 0,
        accuracy: 0,
        lastIncorrectAt: null,
      };
      bucket.total += 1;
      if (result.isCorrect) {
        bucket.correct += 1;
      } else if (
        !bucket.lastIncorrectAt ||
        result.createdAt > bucket.lastIncorrectAt
      ) {
        bucket.lastIncorrectAt = result.createdAt;
      }
      bucket.accuracy = percent(bucket.correct, bucket.total);
      topicStats.set(topic, bucket);
    }

    const scored: ScoredRecommendation[] = [];

    for (const quiz of quizzes) {
      if (quiz.questions.length === 0) continue;

      const topics = quiz.questions.map((q) => q.topic);
      const { topic, accuracy } = pickWeakestTopic(topics, topicStats);
      const lastAttempt = quiz.attempts[0]?.createdAt ?? null;
      const lastScore = quiz.attempts[0]?.scorePercent ?? null;

      // Prefer topic accuracy; fall back to last attempt score.
      const effectiveAccuracy =
        accuracy !== null ? accuracy : lastScore !== null ? lastScore : null;

      const score =
        weaknessScore(effectiveAccuracy) * 1.25 +
        stalenessScore(lastAttempt, now);

      const title =
        quiz.title?.trim() || quiz.note?.title?.trim() || 'Untitled quiz';

      const reasonParts: string[] = [];
      if (topic && effectiveAccuracy !== null) {
        reasonParts.push(
          `${effectiveAccuracy}% accuracy on “${topic}” — good candidate to practice`
        );
      } else if (topic) {
        reasonParts.push(`Covers weak area “${topic}”`);
      }
      reasonParts.push(formatStalenessReason(lastAttempt, now));

      scored.push({
        type: 'quiz',
        title,
        topic,
        courseName: quiz.course?.name ?? null,
        reason: reasonParts.join('. ') + '.',
        href: '/dashboard/quizzes',
        score,
      });
    }

    for (const set of sets) {
      if (set.cards.length === 0) continue;

      const topics = set.cards.map((card) => card.topic);
      const { topic, accuracy } = pickWeakestTopic(topics, topicStats);

      let lastReviewed: Date | null = null;
      for (const card of set.cards) {
        const awardAt = card.reviewAwards[0]?.createdAt ?? null;
        if (awardAt && (!lastReviewed || awardAt > lastReviewed)) {
          lastReviewed = awardAt;
        }
      }

      const score =
        weaknessScore(accuracy) * 1.25 + stalenessScore(lastReviewed, now);

      const reasonParts: string[] = [];
      if (topic && accuracy !== null && accuracy < 75) {
        reasonParts.push(
          `Cards touch “${topic}” (${accuracy}% quiz accuracy) — review this deck`
        );
      } else if (topic && accuracy !== null) {
        reasonParts.push(`Related to “${topic}”`);
      } else if (!lastReviewed) {
        reasonParts.push('Deck has not been reviewed yet');
      }
      reasonParts.push(formatStalenessReason(lastReviewed, now));

      scored.push({
        type: 'flashcards',
        title: set.title.trim() || 'Untitled deck',
        topic,
        courseName: set.course?.name ?? null,
        reason: reasonParts.join('. ') + '.',
        href: `/dashboard/flashcards/study/${set.id}`,
        score,
      });
    }

    scored.sort((a, b) => b.score - a.score);

    // Prefer a mix of types in the top slots when scores are close.
    const picked: ScoredRecommendation[] = [];
    const seenTypes = new Set<ReviewNextType>();
    for (const item of scored) {
      if (picked.length >= limit) break;
      if (
        picked.length < 2 &&
        seenTypes.has(item.type) &&
        scored.some(
          (candidate) =>
            !seenTypes.has(candidate.type) && candidate.score >= item.score - 15
        )
      ) {
        continue;
      }
      picked.push(item);
      seenTypes.add(item.type);
    }

    // Fill remaining slots if type-diversity skip emptied the list early.
    for (const item of scored) {
      if (picked.length >= limit) break;
      if (picked.includes(item)) continue;
      picked.push(item);
    }

    return picked.map(({ score: _score, ...rest }) => rest);
  } catch (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }
}
