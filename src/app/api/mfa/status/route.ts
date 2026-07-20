// Current MFA factor state (US-4.S1) — powers the Security settings tab.

import { NextResponse } from 'next/server';

import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { getMfaFactors } from '@/lib/mfa';

export async function GET() {
  const authResult = await requireUser();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const factors = await getMfaFactors(authResult.user.id);
    return jsonOk(factors);
  } catch (error) {
    console.error('GET /api/mfa/status', error);
    return jsonError('Failed to load MFA status', 500);
  }
}
