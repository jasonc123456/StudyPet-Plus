import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedCoursePlanner } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import {
  confirmCoursePlannerImportSchema,
  zodFirstError,
} from '@/lib/validators';

/**
 * POST /api/course-planners/import/confirm
 *
 * Persist a user-confirmed import draft into an existing planner.
 * Existing sections/courses are preserved; matching section labels are reused.
 */
export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = confirmCoursePlannerImportSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const planner = await getOwnedCoursePlanner(
    parsed.data.plannerId,
    authResult.user.id
  );
  if (!planner) {
    return jsonError('Planner not found', 404);
  }

  const existingSections = await prisma.coursePlannerSection.findMany({
    where: { plannerId: planner.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, label: true, sortOrder: true },
  });

  const sectionByLabel = new Map(
    existingSections.map((section) => [
      section.label.trim().toLowerCase(),
      section,
    ])
  );

  let nextSortOrder =
    existingSections.reduce(
      (max, section) => Math.max(max, section.sortOrder),
      -1
    ) + 1;

  let sectionsCreated = 0;
  let coursesCreated = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const draftSection of parsed.data.sections) {
        const key = draftSection.label.trim().toLowerCase();
        let section = sectionByLabel.get(key);

        if (!section) {
          section = await tx.coursePlannerSection.create({
            data: {
              plannerId: planner.id,
              label: draftSection.label.trim(),
              sortOrder: nextSortOrder,
            },
            select: { id: true, label: true, sortOrder: true },
          });
          sectionByLabel.set(key, section);
          nextSortOrder += 1;
          sectionsCreated += 1;
        }

        for (const course of draftSection.courses) {
          await tx.plannedCourse.create({
            data: {
              sectionId: section.id,
              title: course.title,
              courseNumber: course.courseNumber ?? null,
              units: course.units ?? null,
              professor: course.professor ?? null,
              lectureDays: course.lectureDays ?? null,
              lectureTime: course.lectureTime ?? null,
              lectureLocation: course.lectureLocation ?? null,
              isAlternate: course.isAlternate ?? false,
              notes: course.notes ?? null,
            },
          });
          coursesCreated += 1;
        }
      }

      await tx.coursePlanner.update({
        where: { id: planner.id },
        data: { updatedAt: new Date() },
      });
    });
  } catch (error) {
    console.error('POST /api/course-planners/import/confirm', error);
    return jsonError('Failed to save imported courses', 500);
  }

  return jsonOk({
    success: true,
    plannerId: planner.id,
    sectionsCreated,
    coursesCreated,
  });
}
