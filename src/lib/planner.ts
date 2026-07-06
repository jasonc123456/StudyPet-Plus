import { prisma } from '@/lib/prisma';

/** Returns the course if it belongs to the user, otherwise null. */
export async function getOwnedCourse(courseId: string, userId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, userId },
  });
}
