import type { AcademicSystem } from '@prisma/client';

import { prisma } from '@/lib/prisma';

function nextAcademicYearStart() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 7 ? year : year - 1;
}

export function buildStarterSections(system: AcademicSystem) {
  const baseYear = nextAcademicYearStart();

  if (system === 'SEMESTER') {
    return [
      `Fall ${baseYear}`,
      `Spring ${baseYear + 1}`,
      `Summer ${baseYear + 1}`,
    ];
  }

  return [
    `Fall ${baseYear}`,
    `Winter ${baseYear + 1}`,
    `Spring ${baseYear + 1}`,
    `Summer ${baseYear + 1}`,
  ];
}

export async function createStarterSectionsForPlanner(
  plannerId: string,
  system: AcademicSystem
) {
  const labels = buildStarterSections(system);

  await prisma.coursePlannerSection.createMany({
    data: labels.map((label, index) => ({
      plannerId,
      label,
      sortOrder: index,
    })),
  });
}

export async function getCoursePlannerPageData(userId: string) {
  const plannerDelegate = (
    prisma as typeof prisma & {
      coursePlanner?: typeof prisma.coursePlanner;
    }
  ).coursePlanner;

  if (!plannerDelegate) {
    return {
      planners: [],
      migrationRequired: true,
    };
  }

  try {
    const planners = await plannerDelegate.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        sections: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            courses: {
              orderBy: [{ isAlternate: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    return {
      planners,
      migrationRequired: false,
    };
  } catch {
    return {
      planners: [],
      migrationRequired: true,
    };
  }
}
