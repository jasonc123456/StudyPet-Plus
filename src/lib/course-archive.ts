import { prisma } from '@/lib/prisma';

export const COURSE_ARCHIVE_IDLE_MONTHS = 3;
export const AUTO_ARCHIVE_REASON = 'No tasks for 3 consecutive months';
export const MANUAL_ARCHIVE_REASON = 'Archived by user';

export function courseArchiveCutoff(from = new Date()) {
  const cutoff = new Date(from);
  cutoff.setMonth(cutoff.getMonth() - COURSE_ARCHIVE_IDLE_MONTHS);
  return cutoff;
}

export async function archiveDormantCoursesForUser(userId: string) {
  const cutoff = courseArchiveCutoff();

  return prisma.course.updateMany({
    where: {
      userId,
      archivedAt: null,
      createdAt: { lte: cutoff },
      assignments: {
        none: {
          OR: [{ createdAt: { gte: cutoff } }, { dueAt: { gte: cutoff } }],
        },
      },
    },
    data: {
      archivedAt: new Date(),
      archiveReason: AUTO_ARCHIVE_REASON,
    },
  });
}
