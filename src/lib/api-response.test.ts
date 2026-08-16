/**
 * The MFA authorization matrix.
 *
 * Two things are locked here. First, that requireUser refuses a session which
 * hasn't cleared its second factor — the property that stops a first-factor
 * attacker from calling the API around the /mfa gate. Second, that the weaker
 * requireUserPreMfa guard stays confined to the challenge endpoints, so a new
 * route can't quietly opt out of the gate by importing the wrong helper.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mfa', () => ({ requiresMfaChallenge: vi.fn() }));

import { auth } from '@/auth';
import { requireUser, requireUserPreMfa } from '@/lib/api-response';
import { requiresMfaChallenge } from '@/lib/mfa';

const authMock = vi.mocked(auth);
const requiresMfaChallengeMock = vi.mocked(requiresMfaChallenge);

/**
 * The only routes allowed to authenticate a session that has not cleared MFA.
 * Each one *is* part of proving the second factor; adding anything else here
 * re-opens the bypass, so treat a change to this list as a security review.
 */
const PRE_MFA_ROUTES = [
  'src/app/api/mfa/challenge/options/route.ts',
  'src/app/api/mfa/challenge/totp/route.ts',
  'src/app/api/mfa/challenge/verify/route.ts',
];

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listRouteFiles(full));
    } else if (entry === 'route.ts') {
      out.push(full);
    }
  }
  return out;
}

describe('requireUser', () => {
  beforeEach(() => {
    requiresMfaChallengeMock.mockResolvedValue(false);
  });

  it('401s an anonymous request', async () => {
    authMock.mockResolvedValue(null as never);

    const result = await requireUser();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it('403s a session that has not cleared its second factor', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
    requiresMfaChallengeMock.mockResolvedValue(true);

    const result = await requireUser();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('returns the user once the session has cleared MFA', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } } as never);

    const result = await requireUser();

    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { user: { id: string } }).user.id).toBe('user-1');
  });

  it('does not gate a user with no factor enrolled', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
    requiresMfaChallengeMock.mockResolvedValue(false);

    expect(await requireUser()).not.toBeInstanceOf(NextResponse);
  });
});

describe('requireUserPreMfa', () => {
  it('401s an anonymous request', async () => {
    authMock.mockResolvedValue(null as never);

    const result = await requireUserPreMfa();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it('admits an unverified session so it can submit its second factor', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
    requiresMfaChallengeMock.mockResolvedValue(true);

    expect(await requireUserPreMfa()).not.toBeInstanceOf(NextResponse);
  });
});

describe('route authorization matrix', () => {
  const routes = listRouteFiles(path.join(process.cwd(), 'src/app/api'));

  it('finds the API routes to inspect', () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it('confines requireUserPreMfa to the challenge endpoints', () => {
    const users = routes
      .filter((file) =>
        readFileSync(file, 'utf8').includes('requireUserPreMfa')
      )
      .map((file) =>
        path.relative(process.cwd(), file).split(path.sep).join('/')
      )
      .sort();

    expect(users).toEqual(PRE_MFA_ROUTES);
  });
});
