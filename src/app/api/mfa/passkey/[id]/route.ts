// Remove a registered passkey (US-4.S1). Scoped to the owner via deleteMany so
// a user can never delete another user's credential.

import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const result = await prisma.authenticator.deleteMany({
      where: { id: params.id, userId: authResult.user.id },
    });

    if (result.count === 0) {
      return jsonError('Passkey not found', 404);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    console.error('DELETE /api/mfa/passkey/[id]', error);
    return jsonError('Failed to delete passkey', 500);
  }
}
