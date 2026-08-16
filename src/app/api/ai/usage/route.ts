import { NextResponse } from 'next/server';

import { getAiUsage } from '@/lib/ai/entitlement';
import { jsonOk, requireUser } from '@/lib/api-response';

// Reads a per-user counter, so it must never be cached or statically rendered.
export const dynamic = 'force-dynamic';

/** Today's AI allowance for the signed-in user. Drives the sidebar meter. */
export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  return jsonOk(await getAiUsage(authResult.user.id));
}
