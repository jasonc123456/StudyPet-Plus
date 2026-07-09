import { GroupRole } from '@prisma/client';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createGroupSchema } from '@/lib/group-validators';
import { zodFirstError } from '@/lib/validators';
import { prisma } from '@/lib/prisma';
import { buildGroupSummary } from '@/lib/groups';

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const groups = await prisma.studyGroup.findMany({
    where: {
      memberships: { some: { userId: authResult.user.id } },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      memberships: {
        where: { userId: authResult.user.id },
        select: { role: true },
      },
      _count: {
        select: {
          memberships: true,
          channels: true,
          tasks: true,
        },
      },
    },
  });

  return jsonOk(groups.map(buildGroupSummary));
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

  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const { name, description } = parsed.data;

  const group = await prisma.$transaction(async (tx) => {
    const createdGroup = await tx.studyGroup.create({
      data: {
        name,
        description: description || null,
        createdById: authResult.user.id,
      },
    });

    await tx.groupMembership.create({
      data: {
        groupId: createdGroup.id,
        userId: authResult.user.id,
        role: GroupRole.OWNER,
      },
    });

    await tx.groupChannel.create({
      data: {
        groupId: createdGroup.id,
        createdById: authResult.user.id,
        name: 'general',
        description: 'Default discussion channel',
        position: 0,
      },
    });

    return tx.studyGroup.findUniqueOrThrow({
      where: { id: createdGroup.id },
      include: {
        memberships: {
          where: { userId: authResult.user.id },
          select: { role: true },
        },
        _count: {
          select: {
            memberships: true,
            channels: true,
            tasks: true,
          },
        },
      },
    });
  });

  return jsonOk(buildGroupSummary(group), 201);
}
