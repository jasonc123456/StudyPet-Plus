import { prisma } from '@/lib/prisma';

export type DashboardPet = {
  name: string;
  xp: number;
  level: number;
  stage: string;
  streakCount: number;
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

export type DashboardData = {
  courses: DashboardCourse[];
  stats: DashboardStats;
  upcomingAssignments: DashboardAssignment[];
  openQuests: DashboardQuest[];
  pet: DashboardPet | null;
};

function weekWindowFrom(now: Date): { start: Date; end: Date } {
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return { start: now, end };
}

/**
 * Loads all dashboard sections for a user from the database.
 *
 * Note: "Cards studied today" is not available yet — the schema has no
 * Flashcard, StudySession, Review, or QuizAttempt model (Sprint 4+). The
 * dashboard uses "Open quests" instead, which is backed by Quest rows.
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
  ] = await Promise.all([
    prisma.course.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, name: true, color: true, term: true },
    }),
    prisma.assignment.count({
      where: {
        course: { userId },
        status: { not: 'done' },
        dueAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    prisma.quest.count({
      where: { userId, status: { not: 'done' } },
    }),
    prisma.assignment.findMany({
      where: {
        course: { userId },
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
      },
    }),
  ]);

  const pet = petRow
    ? {
        name: petRow.name,
        xp: petRow.xp,
        level: petRow.level,
        stage: petRow.stage,
        streakCount: petRow.streakCount,
      }
    : null;

  return {
    courses,
    stats: {
      openQuests: openQuestCount,
      // No pet row yet — streak defaults to 0 until Sprint 4 creates/updates pets.
      studyStreak: pet?.streakCount ?? 0,
      dueThisWeek,
    },
    upcomingAssignments,
    openQuests,
    pet,
  };
}
