import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import {
  consumeImportDraft,
  MAX_COURSES_PER_PLANNER,
} from '@/lib/import-draft';
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
 *
 * Size is bounded by the schema (see MAX_IMPORT_* in validators), which rejects
 * an oversized plan before this route opens a transaction, and courses are
 * written one statement per section rather than one per course — together those
 * put a ceiling on how long a single import can hold the transaction open.
 *
 * Those bound one request. Repetition is bounded separately: the draft token
 * issued by the parse step is spent here, so replaying a confirmation finds
 * nothing to spend, and the planner has a total course ceiling regardless of how
 * many distinct imports are run against it.
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

  // Spent before any work: a replay stops here, and two confirmations racing the
  // same token mean exactly one of them proceeds.
  const spent = await consumeImportDraft(
    parsed.data.draftToken,
    authResult.user.id,
    planner.id
  );
  if (!spent) {
    return jsonError(
      'This import has already been saved, or the preview expired. Parse the plan again.',
      409
    );
  }

  const incomingCourses = parsed.data.sections.reduce(
    (total, section) => total + section.courses.length,
    0
  );
  const existingCourses = await prisma.plannedCourse.count({
    where: { section: { plannerId: planner.id } },
  });
  if (existingCourses + incomingCourses > MAX_COURSES_PER_PLANNER) {
    return jsonError(
      `This planner can hold at most ${MAX_COURSES_PER_PLANNER} courses.`,
      400
    );
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

        // One statement per section instead of one per course. The old loop
        // awaited a round-trip for every single course, so a large plan held
        // the transaction — and its locks — open for the sum of all of them.
        const { count } = await tx.plannedCourse.createMany({
          data: draftSection.courses.map((course) => ({
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
          })),
        });
        coursesCreated += count;
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
