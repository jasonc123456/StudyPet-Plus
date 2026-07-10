import { prisma } from '@/lib/prisma';

export const DEFAULT_GRADE_SCALE = [
  { label: 'A+', minPercent: 95, maxPercent: 100, gpaPoints: 4.0 },
  { label: 'A', minPercent: 90, maxPercent: 94.99, gpaPoints: 4.0 },
  { label: 'A-', minPercent: 87, maxPercent: 89.99, gpaPoints: 3.7 },
  { label: 'B+', minPercent: 83, maxPercent: 86.99, gpaPoints: 3.3 },
  { label: 'B', minPercent: 80, maxPercent: 82.99, gpaPoints: 3.0 },
  { label: 'B-', minPercent: 77, maxPercent: 79.99, gpaPoints: 2.7 },
  { label: 'C+', minPercent: 73, maxPercent: 76.99, gpaPoints: 2.3 },
  { label: 'C', minPercent: 70, maxPercent: 72.99, gpaPoints: 2.0 },
  { label: 'C-', minPercent: 67, maxPercent: 69.99, gpaPoints: 1.7 },
  { label: 'D+', minPercent: 63, maxPercent: 66.99, gpaPoints: 1.3 },
  { label: 'D', minPercent: 60, maxPercent: 62.99, gpaPoints: 1.0 },
  { label: 'F', minPercent: 0, maxPercent: 59.99, gpaPoints: 0 },
] as const;

type GradeScaleEntryLike = {
  id?: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  gpaPoints: number;
  sortOrder?: number;
};

type GradeItemLike = {
  id: string;
  title: string;
  scoreEarned: number;
  scorePossible: number;
  assignmentId: string | null;
  gradedAt: Date | string;
  notes: string | null;
};

type GradeCategoryLike = {
  id: string;
  name: string;
  weight: number;
  items: GradeItemLike[];
};

export function sortGradeScaleEntries<T extends GradeScaleEntryLike>(
  entries: T[]
) {
  return [...entries].sort((a, b) => {
    if (b.minPercent !== a.minPercent) return b.minPercent - a.minPercent;
    if (b.maxPercent !== a.maxPercent) return b.maxPercent - a.maxPercent;
    return a.label.localeCompare(b.label);
  });
}

export function resolveLetterGrade(
  percent: number | null,
  entries: GradeScaleEntryLike[]
) {
  if (percent === null || Number.isNaN(percent)) {
    return null;
  }

  const scale = sortGradeScaleEntries(
    entries.length > 0 ? entries : [...DEFAULT_GRADE_SCALE]
  );

  return (
    scale.find(
      (entry) => percent >= entry.minPercent && percent <= entry.maxPercent
    ) ?? null
  );
}

export function summarizeGradeCategory(category: GradeCategoryLike) {
  const totals = category.items.reduce(
    (acc, item) => {
      acc.earned += item.scoreEarned;
      acc.possible += item.scorePossible;
      return acc;
    },
    { earned: 0, possible: 0 }
  );

  const percent =
    totals.possible > 0 ? (totals.earned / totals.possible) * 100 : null;

  return {
    itemCount: category.items.length,
    earned: totals.earned,
    possible: totals.possible,
    percent,
    weightedContribution:
      percent === null ? 0 : (percent * category.weight) / 100,
  };
}

type CourseWithGradeCategories = {
  id: string;
  name: string;
  credits: number;
  gradeCategories: GradeCategoryLike[];
};

export function summarizeCourseGrades<T extends CourseWithGradeCategories>(
  course: T,
  scaleEntries: GradeScaleEntryLike[]
) {
  const categories = course.gradeCategories.map((category) => {
    const summary = summarizeGradeCategory(category);
    return { ...category, summary };
  });

  const gradedWeight = categories.reduce(
    (total, category) =>
      category.summary.percent === null ? total : total + category.weight,
    0
  );

  const weightedPoints = categories.reduce(
    (total, category) => total + category.summary.weightedContribution,
    0
  );

  const currentPercent =
    gradedWeight > 0 ? (weightedPoints / gradedWeight) * 100 : null;
  const totalWeight = categories.reduce(
    (total, category) => total + category.weight,
    0
  );
  const remainingWeight = Math.max(0, 100 - totalWeight);
  const letterGrade = resolveLetterGrade(currentPercent, scaleEntries);

  return {
    categories,
    gradedWeight,
    totalWeight,
    remainingWeight,
    weightedPoints,
    currentPercent,
    letterGrade,
    currentGpaPoints: letterGrade?.gpaPoints ?? null,
  };
}

export function summarizeGradeTracker<
  TCourse extends CourseWithGradeCategories,
>(args: {
  currentGpa: number | null;
  completedCredits: number;
  courses: TCourse[];
  scaleEntries: GradeScaleEntryLike[];
}) {
  const courses = args.courses.map((course) => ({
    ...course,
    summary: summarizeCourseGrades(course, args.scaleEntries),
  }));

  const activeCourses = courses.filter(
    (course) => course.summary.currentGpaPoints !== null
  );
  const currentTermCredits = activeCourses.reduce(
    (total, course) => total + course.credits,
    0
  );

  const currentTermQualityPoints = activeCourses.reduce(
    (total, course) =>
      total + course.credits * (course.summary.currentGpaPoints ?? 0),
    0
  );

  const termGpa =
    currentTermCredits > 0
      ? currentTermQualityPoints / currentTermCredits
      : null;

  const hasBaseline =
    args.currentGpa !== null &&
    args.currentGpa !== undefined &&
    args.completedCredits > 0;

  const projectedCumulativeGpa =
    termGpa === null
      ? args.currentGpa
      : hasBaseline
        ? (args.currentGpa! * args.completedCredits +
            currentTermQualityPoints) /
          (args.completedCredits + currentTermCredits)
        : termGpa;

  return {
    courses,
    summary: {
      currentTermCredits,
      termGpa,
      projectedCumulativeGpa,
    },
  };
}

export async function getGradeTrackerPageData(userId: string) {
  const [profile, savedScaleEntries, courses] = await Promise.all([
    prisma.gradeProfile.findUnique({
      where: { userId },
    }),
    prisma.gradeScaleEntry.findMany({
      where: { userId },
      orderBy: [
        { minPercent: 'desc' },
        { maxPercent: 'desc' },
        { label: 'asc' },
      ],
    }),
    prisma.course.findMany({
      where: { userId, archivedAt: null },
      orderBy: { name: 'asc' },
      include: {
        assignments: {
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            type: true,
            dueAt: true,
          },
        },
        gradeCategories: {
          orderBy: { createdAt: 'asc' },
          include: {
            items: {
              orderBy: [{ gradedAt: 'desc' }, { createdAt: 'desc' }],
            },
          },
        },
      },
    }),
  ]);

  const scaleEntries =
    savedScaleEntries.length > 0
      ? savedScaleEntries
      : DEFAULT_GRADE_SCALE.map((entry, index) => ({
          id: `default-${index}`,
          ...entry,
          sortOrder: index,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }));

  const tracker = summarizeGradeTracker({
    currentGpa: profile?.currentGpa ?? null,
    completedCredits: profile?.completedCredits ?? 0,
    courses,
    scaleEntries,
  });

  return {
    profile: {
      currentGpa: profile?.currentGpa ?? null,
      completedCredits: profile?.completedCredits ?? 0,
    },
    scaleEntries,
    hasCustomScale: savedScaleEntries.length > 0,
    courses: tracker.courses,
    summary: tracker.summary,
  };
}
