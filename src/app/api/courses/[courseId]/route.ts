import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { MANUAL_ARCHIVE_REASON } from '@/lib/course-archive';
import { getOwnedCourse } from '@/lib/planner';
import {
  updateCourseArchiveSchema,
  updateCourseSchema,
  zodFirstError,
} from '@/lib/validators';

type RouteContext = { params: { courseId: string } };

export async function PUT(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const existing = await getOwnedCourse(params.courseId, authResult.user.id);
  if (!existing) {
    return jsonError('Course not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { name, color, term, credits } = parsed.data;

  const course = await prisma.course.update({
    where: { id: params.courseId },
    data: {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(term !== undefined && { term: term || null }),
      ...(credits !== undefined && { credits }),
    },
    include: { _count: { select: { assignments: true } } },
  });

  return jsonOk(course);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const existing = await getOwnedCourse(params.courseId, authResult.user.id);
  if (!existing) {
    return jsonError('Course not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateCourseArchiveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const course = await prisma.course.update({
    where: { id: params.courseId },
    data: parsed.data.archived
      ? { archivedAt: new Date(), archiveReason: MANUAL_ARCHIVE_REASON }
      : { archivedAt: null, archiveReason: null },
    include: { _count: { select: { assignments: true } } },
  });

  return jsonOk(course);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const existing = await getOwnedCourse(params.courseId, authResult.user.id);
  if (!existing) {
    return jsonError('Course not found', 404);
  }

  await prisma.course.delete({ where: { id: params.courseId } });

  return jsonOk({ success: true });
}
