import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

import { auth } from '@/auth';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Returns the session user or a 401 response — never both. */
export async function requireUser(): Promise<
  { user: NonNullable<Session['user']> } | NextResponse
> {
  const session = await auth();

  if (!session?.user?.id) {
    return jsonError('Unauthorized', 401);
  }

  return { user: session.user };
}
