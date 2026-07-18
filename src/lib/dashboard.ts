import { prisma } from '@/lib/prisma';
import { getVisibleStreakCount } from '@/lib/pet-xp';
import { Prisma } from '@prisma/client';

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
  hasFlashcards: boolean;
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
                    flashcards: {
                      where: { userId },
                      select: { id: true },
                      take: 1,
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
    DashboardReviewNext & { latestIncorrectAt: Date }
  >();

  for (const result of weakTopicResults) {
    const topic = result.question.topic.trim();
    const note = result.question.quiz.note;
    if (!topic || !note) continue;

    const key = `${note.id}:${topic.toLowerCase()}`;
    const existing = reviewNextMap.get(key);

    if (!existing) {
      reviewNextMap.set(key, {
        topic,
        incorrectCount: 1,
        noteId: note.id,
        noteTitle: note.title,
        quizId: result.question.quiz.id,
        hasFlashcards: note.flashcards.length > 0,
        latestIncorrectAt: result.createdAt,
      });
      continue;
    }

    existing.incorrectCount += 1;
    if (result.createdAt > existing.latestIncorrectAt) {
      existing.latestIncorrectAt = result.createdAt;
      existing.quizId = result.question.quiz.id;
    }
  }

  const reviewNext =
    [...reviewNextMap.values()].sort((a, b) => {
      if (b.incorrectCount !== a.incorrectCount) {
        return b.incorrectCount - a.incorrectCount;
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
          hasFlashcards: reviewNext.hasFlashcards,
        }
      : null,
  };
}
