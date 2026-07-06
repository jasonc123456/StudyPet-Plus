import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { createQuestSchema, zodFirstError } from '@/lib/validators';

export async function GET(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const quests = await prisma.quest.findMany({
    where: {
      userId: authResult.user.id,
      ...(status && { status }),
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  return jsonOk(quests);
}

export async function POST(request: Request) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createQuestSchema.safeParse(body);
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

  const quest = await prisma.quest.create({
    data: {
      userId: authResult.user.id,
      title,
      description: description || null,
      dueAt,
      status,
      difficulty,
      estimatedMinutes,
      xpReward,
    },
  });

  return jsonOk(quest, 201);
}
