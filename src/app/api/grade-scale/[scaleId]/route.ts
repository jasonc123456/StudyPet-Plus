import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: { scaleId: string };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const existing = await prisma.gradeScaleEntry.findFirst({
      where: {
        id: params.scaleId,
        userId: authResult.user.id,
      },
    });

    if (!existing) {
      return jsonError('Grade scale entry not found', 404);
    }

    await prisma.gradeScaleEntry.delete({
      where: { id: params.scaleId },
    });

    return jsonOk({ success: true });
  } catch (error) {
    console.error('DELETE /api/grade-scale/[scaleId]', error);
    return jsonError('Failed to delete grade scale entry', 500);
  }
}
