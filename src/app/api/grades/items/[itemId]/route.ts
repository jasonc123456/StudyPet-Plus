import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getOwnedGradeItem } from '@/lib/planner';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { itemId: string };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const existing = await getOwnedGradeItem(params.itemId, authResult.user.id);
    if (!existing) {
      return jsonError('Grade item not found', 404);
    }

    await prisma.gradeItem.delete({
      where: { id: params.itemId },
    });

    return jsonOk({ success: true });
  } catch (error) {
    console.error('DELETE /api/grades/items/[itemId]', error);
    return jsonError('Failed to delete grade item', 500);
  }
}
