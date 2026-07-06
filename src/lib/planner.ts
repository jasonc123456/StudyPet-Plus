import { prisma } from '@/lib/prisma';

/** Returns the course if it belongs to the user, otherwise null. */
export async function getOwnedCourse(courseId: string, userId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, userId },
  });
}

/** Returns the assignment if it belongs to a course owned by the user. */
export async function getOwnedAssignment(
  courseId: string,
  assignmentId: string,
  userId: string
) {
  return prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      courseId,
      course: { userId },
    },
    include: {
      course: { select: { id: true, name: true, color: true } },
    },
  });
}
