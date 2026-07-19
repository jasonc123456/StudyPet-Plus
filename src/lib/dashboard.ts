import { prisma } from '@/lib/prisma';
import { getVisibleStreakCount } from '@/lib/pet-xp';
import { Prisma } from '@prisma/client';
import { richTextToPlainText, hasVisibleRichText } from '@/lib/note-rich-text';

export type DashboardPet = {
  name: string;
  xp: number;
  level: number;
  stage: string;
  streakCount: number;
  lastStudyDate: Date | null;
};

export type DashboardStats = {
  /** Open (non-done) quests for the user. */
  openQuests: number;
  /** Pet.streakCount when a pet row exists; otherwise 0. */
  studyStreak: number;
  /** Open assignments with dueAt in the next 7 days. */
  dueThisWeek: number;
};

export type DashboardCourse = {
  id: string;
  name: string;
  color: string;
  term: string | null;
};

export type DashboardAssignment = {
  id: string;
  courseId: string;
  title: string;
  dueAt: Date | null;
  status: string;
  course: { id: string; name: string; color: string };
};

export type DashboardQuest = {
  id: string;
  title: string;
  dueAt: Date | null;
  xpReward: number;
  status: string;
};

export type DashboardReviewNext = {
  topic: string;
  incorrectCount: number;
  noteId: string;
  noteTitle: string;
  quizId: string;
  flashcardCount: number;
  recommendedAction: 'flashcards' | 'notes' | 'quiz';
  recommendationReason: string;
  rankingScore: number;
};

export type DashboardData = {
  courses: DashboardCourse[];
  stats: DashboardStats;
  upcomingAssignments: DashboardAssignment[];
  openQuests: DashboardQuest[];
  pet: DashboardPet | null;
  reviewNext: DashboardReviewNext | null;
};

function weekWindowFrom(now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return { start: now, end };
}

function recencyScore(latestIncorrectAt: Date, now: Date): number {
  const elapsedHours =
    (now.getTime() - latestIncorrectAt.getTime()) / (1000 * 60 * 60);

  if (elapsedHours <= 24) return 15;
  if (elapsedHours <= 72) return 10;
  if (elapsedHours <= 168) return 5;
  return 2;
}

function scoreStudyActions(args: {
  incorrectCount: number;
  latestIncorrectAt: Date;
  flashcardCount: number;
  noteWordCount: number;
  now: Date;
}) {
  const {
    incorrectCount,
    latestIncorrectAt,
    flashcardCount,
    noteWordCount,
    now,
  } = args;

  const weaknessScore = incorrectCount * 12;
  const freshnessScore = recencyScore(latestIncorrectAt, now);
  const noteDepthScore =
    noteWordCount >= 250 ? 6 : noteWordCount >= 100 ? 4 : 2;

  const flashcards =
    flashcardCount > 0
      ? 26 +
        weaknessScore +
        freshnessScore +
        Math.min(flashcardCount, 5) * 3 +
        (incorrectCount >= 2 ? 8 : 0)
      : Number.NEGATIVE_INFINITY;

  const notes =
    24 +
    weaknessScore +
    freshnessScore +
    noteDepthScore +
    (flashcardCount === 0 ? 8 : 0) +
    (incorrectCount >= 3 ? 6 : 0);

  const quiz =
    20 +
    weaknessScore +
    Math.max(0, 10 - freshnessScore) +
    (incorrectCount === 1 ? 10 : 4);

  return { flashcards, notes, quiz };
}

function recommendationReason(args: {
  action: DashboardReviewNext['recommendedAction'];
  incorrectCount: number;
  flashcardCount: number;
  noteTitle: string;
}) {
  const { action, incorrectCount, flashcardCount, noteTitle } = args;

  if (action === 'flashcards') {
    return `You already have ${flashcardCount} flashcard${
      flashcardCount === 1 ? '' : 's'
    } in “${noteTitle}”, so quick active recall is the fastest way to patch ${incorrectCount} missed question${
      incorrectCount === 1 ? '' : 's'
    }.`;
  }

  if (action === 'notes') {
    return `Go back through “${noteTitle}” first because this topic has caused ${incorrectCount} missed question${
      incorrectCount === 1 ? '' : 's'
    } and the underlying concept needs a fuller read-through before retesting.`;
  }

  return `Retake the quiz next to check whether this weak spot sticks after review. This topic has already missed ${incorrectCount} question${
    incorrectCount === 1 ? '' : 's'
  }.`;
}

async function getWeakTopicResults(userId: string) {
  const quizQuestionResultDelegate = (
    prisma as typeof prisma & {
      quizQuestionResult?: {
        findMany: typeof prisma.$queryRaw;
      };
    }
  ).quizQuestionResult;

  if (!quizQuestionResultDelegate) {
    return [];
  }

  try {
    return await quizQuestionResultDelegate.findMany({
      where: {
        userId,
        isCorrect: false,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
      select: {
        createdAt: true,
        question: {
          select: {
            topic: true,
            quiz: {
              select: {
                id: true,
                note: {
                  select: {
                    id: true,
                    title: true,
                    content: true,
                    flashcards: {
                      where: { userId },
                      select: { id: true, topic: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    ) {
      return [];
    }

    throw error;
  }
}

/**
 * Loads all dashboard sections for a user from the database.
 *
 * The dashboard mixes planner status with lightweight study recommendations.
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = weekWindowFrom(now);

  const [
    courses,
    dueThisWeek,
    openQuestCount,
    upcomingAssignments,
    openQuests,
    petRow,
    weakTopicResults,
  ] = await Promise.all([
    prisma.course.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, name: true, color: true, term: true },
    }),
    prisma.assignment.count({
      where: {
        course: { userId, archivedAt: null },
        status: { not: 'done' },
        dueAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    prisma.quest.count({
      where: { userId, status: { not: 'done' } },
    }),
    prisma.assignment.findMany({
      where: {
        course: { userId, archivedAt: null },
        status: { not: 'done' },
      },
      select: {
        id: true,
        courseId: true,
        title: true,
        dueAt: true,
        status: true,
        course: { select: { id: true, name: true, color: true } },
      },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 8,
    }),
    prisma.quest.findMany({
      where: { userId, status: { not: 'done' } },
      select: {
        id: true,
        title: true,
        dueAt: true,
        xpReward: true,
        status: true,
      },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 8,
    }),
    prisma.pet.findUnique({
      where: { userId },
      select: {
        name: true,
        xp: true,
        level: true,
        stage: true,
        streakCount: true,
        lastStudyDate: true,
      },
    }),
    getWeakTopicResults(userId),
  ]);

  const basePet = petRow
    ? {
        name: petRow.name,
        xp: petRow.xp,
        level: petRow.level,
        stage: petRow.stage,
        streakCount: petRow.streakCount,
        lastStudyDate: petRow.lastStudyDate,
      }
    : null;

  const visibleStudyStreak = basePet
    ? getVisibleStreakCount({
        lastStudyDate: basePet.lastStudyDate,
        streakCount: basePet.streakCount,
        now,
      })
    : 0;

  const pet = basePet
    ? {
        ...basePet,
        streakCount: visibleStudyStreak,
      }
    : null;

  const reviewNextMap = new Map<
    string,
    {
      topic: string;
      incorrectCount: number;
      noteId: string;
      noteTitle: string;
      quizId: string;
      flashcardCount: number;
      latestIncorrectAt: Date;
      noteWordCount: number;
      rankingScore: number;
      recommendedAction: DashboardReviewNext['recommendedAction'];
      recommendationReason: string;
    }
  >();

  for (const result of weakTopicResults) {
    const topic = result.question.topic.trim();
    const note = result.question.quiz.note;
    if (!topic || !note) continue;

    const key = `${note.id}:${topic.toLowerCase()}`;
    const existing = reviewNextMap.get(key);
    const topicFlashcardCount = note.flashcards.filter(
      (flashcard) =>
        flashcard.topic.trim().toLowerCase() === topic.toLowerCase()
    ).length;
    const totalFlashcardCount = note.flashcards.length;
    const flashcardCount =
      topicFlashcardCount > 0 ? topicFlashcardCount : totalFlashcardCount;
    const noteWordCount = hasVisibleRichText(note.content)
      ? richTextToPlainText(note.content).split(/\s+/).filter(Boolean).length
      : 0;

    if (!existing) {
      const actionScores = scoreStudyActions({
        incorrectCount: 1,
        latestIncorrectAt: result.createdAt,
        flashcardCount,
        noteWordCount,
        now,
      });
      const recommendedAction =
        actionScores.flashcards >= actionScores.notes &&
        actionScores.flashcards >= actionScores.quiz
          ? 'flashcards'
          : actionScores.notes >= actionScores.quiz
            ? 'notes'
            : 'quiz';
      const rankingScore =
        recommendedAction === 'flashcards'
          ? actionScores.flashcards
          : recommendedAction === 'notes'
            ? actionScores.notes
            : actionScores.quiz;

      reviewNextMap.set(key, {
        topic,
        incorrectCount: 1,
        noteId: note.id,
        noteTitle: note.title,
        quizId: result.question.quiz.id,
        flashcardCount,
        latestIncorrectAt: result.createdAt,
        noteWordCount,
        rankingScore,
        recommendedAction,
        recommendationReason: recommendationReason({
          action: recommendedAction,
          incorrectCount: 1,
          flashcardCount,
          noteTitle: note.title,
        }),
      });
      continue;
    }

    existing.incorrectCount += 1;
    if (result.createdAt > existing.latestIncorrectAt) {
      existing.latestIncorrectAt = result.createdAt;
      existing.quizId = result.question.quiz.id;
    }

    const actionScores = scoreStudyActions({
      incorrectCount: existing.incorrectCount,
      latestIncorrectAt: existing.latestIncorrectAt,
      flashcardCount: existing.flashcardCount,
      noteWordCount: existing.noteWordCount,
      now,
    });
    existing.recommendedAction =
      actionScores.flashcards >= actionScores.notes &&
      actionScores.flashcards >= actionScores.quiz
        ? 'flashcards'
        : actionScores.notes >= actionScores.quiz
          ? 'notes'
          : 'quiz';
    existing.rankingScore =
      existing.recommendedAction === 'flashcards'
        ? actionScores.flashcards
        : existing.recommendedAction === 'notes'
          ? actionScores.notes
          : actionScores.quiz;
    existing.recommendationReason = recommendationReason({
      action: existing.recommendedAction,
      incorrectCount: existing.incorrectCount,
      flashcardCount: existing.flashcardCount,
      noteTitle: existing.noteTitle,
    });
  }

  const reviewNext =
    [...reviewNextMap.values()].sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }

      return b.latestIncorrectAt.getTime() - a.latestIncorrectAt.getTime();
    })[0] ?? null;

  return {
    courses,
    stats: {
      openQuests: openQuestCount,
      studyStreak: visibleStudyStreak,
      dueThisWeek,
    },
    upcomingAssignments,
    openQuests,
    pet,
    reviewNext: reviewNext
      ? {
          topic: reviewNext.topic,
          incorrectCount: reviewNext.incorrectCount,
          noteId: reviewNext.noteId,
          noteTitle: reviewNext.noteTitle,
          quizId: reviewNext.quizId,
          flashcardCount: reviewNext.flashcardCount,
          recommendedAction: reviewNext.recommendedAction,
          recommendationReason: reviewNext.recommendationReason,
          rankingScore: reviewNext.rankingScore,
        }
      : null,
  };
}
