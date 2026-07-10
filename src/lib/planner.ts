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

/** Returns the note if it belongs to the user, otherwise null. */
export async function getOwnedNote(noteId: string, userId: string) {
  return prisma.note.findFirst({
    where: {
      id: noteId,
      userId,
    },
  });
}

/** Returns the grade category if it belongs to one of the user's courses. */
export async function getOwnedGradeCategory(
  categoryId: string,
  userId: string
) {
  return prisma.gradeCategory.findFirst({
    where: {
      id: categoryId,
      course: { userId },
    },
  });
}

/** Returns the grade item if it belongs to one of the user's courses. */
export async function getOwnedGradeItem(itemId: string, userId: string) {
  return prisma.gradeItem.findFirst({
    where: {
      id: itemId,
      category: {
        course: { userId },
      },
    },
    include: {
      category: true,
    },
  });
}

/** Returns the course planner if it belongs to the user, otherwise null. */
export async function getOwnedCoursePlanner(plannerId: string, userId: string) {
  return prisma.coursePlanner.findFirst({
    where: {
      id: plannerId,
      userId,
    },
  });
}

/** Returns the planner section if it belongs to the user, otherwise null. */
export async function getOwnedCoursePlannerSection(
  sectionId: string,
  userId: string
) {
  return prisma.coursePlannerSection.findFirst({
    where: {
      id: sectionId,
      planner: { userId },
    },
  });
}

/** Returns the planned course if it belongs to the user, otherwise null. */
export async function getOwnedPlannedCourse(courseId: string, userId: string) {
  return prisma.plannedCourse.findFirst({
    where: {
      id: courseId,
      section: {
        planner: { userId },
      },
    },
  });
}
