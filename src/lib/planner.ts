import { prisma } from '@/lib/prisma';

/** Returns the course if it belongs to the user, otherwise null. */
export async function getOwnedCourse(courseId: string, userId: string) {
  return prisma.course.findFirst({
    where: { id: courseId, userId },
  });
}

/** Returns the assignment if it belongs to the user's course, otherwise null. */
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
  });
}

/** Returns the quest if it belongs to the user, otherwise null. */
export async function getOwnedQuest(questId: string, userId: string) {
  return prisma.quest.findFirst({
    where: {
      id: questId,
      userId,
    },
  });
}
