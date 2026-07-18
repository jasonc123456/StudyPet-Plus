import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { recordStudyActivity } from '@/lib/pet-xp';
import { getOwnedQuest } from '@/lib/planner';
import { prisma } from '@/lib/prisma';
import { updateQuestSchema, zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { questId: string };
};

export async function PUT(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedQuest(params.questId, authResult.user.id);
  if (!existing) {
    return jsonError('Quest not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateQuestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const {
    title,
    description,
    dueAt,
    status,
    difficulty,
    estimatedMinutes,
    xpReward,
  } = parsed.data;

  const shouldAwardXp =
    status === 'done' &&
    existing.status !== 'done' &&
    existing.rewardClaimed === false;

  const quest = await prisma.$transaction(async (tx) => {
    const updatedQuest = await tx.quest.update({
      where: { id: params.questId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(dueAt !== undefined && { dueAt }),
        ...(status !== undefined && { status }),
        ...(difficulty !== undefined && { difficulty }),
        ...(estimatedMinutes !== undefined && { estimatedMinutes }),
        ...(xpReward !== undefined && { xpReward }),
        ...(shouldAwardXp && { rewardClaimed: true }),
      },
    });

    if (shouldAwardXp) {
      await recordStudyActivity(authResult.user.id, {
        xp: updatedQuest.xpReward,
        client: tx,
      });
    }

    return updatedQuest;
  });

  return jsonOk(quest);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const existing = await getOwnedQuest(params.questId, authResult.user.id);
  if (!existing) {
    return jsonError('Quest not found', 404);
  }

  await prisma.quest.delete({ where: { id: params.questId } });

  return jsonOk({ success: true });
}
