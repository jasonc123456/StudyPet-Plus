import { prisma } from '@/lib/prisma';
import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createCourseSchema, zodFirstError } from '@/lib/validators';

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const courses = await prisma.course.findMany({
    where: { userId: authResult.user.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { assignments: true } } },
  });

  return jsonOk(courses);
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { name, color, term, credits } = parsed.data;

  const course = await prisma.course.create({
    data: {
      userId: authResult.user.id,
      name,
      color,
      term: term || null,
      credits,
    },
    include: { _count: { select: { assignments: true } } },
  });

  return jsonOk(course, 201);
}
