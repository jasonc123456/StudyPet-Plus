// One-click demo login — no email round-trip.
//
// StudyPet+ uses passwordless magic-link auth, so there's no password to post.
// Instead this handler mints a real database-backed NextAuth session for the
// shared demo user and sets the session cookie, exactly like a normal sign-in
// would. `auth()` (getServerSession) then resolves it on every page.
//
// Reached via the "🚀 Try the demo" button on the landing page
// (components/DemoLoginButton.tsx).
//
// Everything below exists because this endpoint is unauthenticated and does
// real work. It used to be a GET that, on every single hit, deleted and
// recreated the demo user's courses, quests and pet and inserted a fresh
// 30-day session row — so anyone could turn a stream of plain link fetches
// into unbounded database writes, and any cross-site page could silently
// install a demo session in a visitor's browser. Four things fix that:
//
//   * POST only, with a double-submit CSRF token, so it can't be triggered by
//     navigation from another origin;
//   * a per-IP rate limit, checked before any database work;
//   * seeding that is skipped unless the data is missing or the cooldown has
//     passed, instead of running unconditionally;
//   * one shared, short-lived session reused across visitors rather than a new
//     30-day row per request, with expired rows swept as we go.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import { jsonError, jsonOk } from '@/lib/api-response';
// Shared with the AI entitlement check, which must recognise this account.
import { DEMO_EMAIL } from '@/lib/demo-account';
import { prisma } from '@/lib/prisma';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// Always run on the server per request — never cache (it sets a cookie).
export const dynamic = 'force-dynamic';

const DEMO_NAME = 'Demo Student';

/**
 * One day, not thirty. A demo session is for a sitting, and the old 30-day
 * expiry meant every request left a long-lived row behind forever.
 */
const SESSION_HOURS = 24;

/** Reuse a session only while it has real time left, so nobody gets a stub. */
const SESSION_REUSE_MIN_REMAINING_MS = 60 * 60 * 1000;

/**
 * Ceiling on live demo session rows.
 *
 * Sweeping expired rows alone doesn't bound anything — the old code minted a
 * 30-day session per request, so unexpired junk was the whole problem (this
 * install had accumulated 78 of them). With reuse in place new rows are rare,
 * so trimming to the newest few costs nobody a session in practice.
 */
const MAX_DEMO_SESSIONS = 25;

/** Destructive reseeding is throttled to this, regardless of traffic. */
const RESEED_COOLDOWN_MS = 15 * 60 * 1000;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const CSRF_COOKIE = 'demo-csrf';

/**
 * Last successful reseed, per process.
 *
 * In-memory like the rate limiter, and for the same reason — one process. A
 * restart just means the next caller reseeds once, which is harmless.
 */
let lastSeededAt = 0;

function daysFromNow(days: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

const demoCourses = [
  {
    name: 'Intro to Computer Science',
    color: '#6366f1',
    term: 'Fall 2026',
    assignments: [
      {
        title: 'Problem Set 3',
        type: 'homework',
        status: 'todo',
        dueInDays: 2,
      },
      { title: 'Midterm Exam', type: 'exam', status: 'todo', dueInDays: 6 },
      {
        title: 'Hello World Lab',
        type: 'homework',
        status: 'done',
        dueInDays: -3,
        description: 'Set up the toolchain and print "Hello, World!".',
      },
    ],
  },
  {
    name: 'Calculus II',
    color: '#eab308',
    term: 'Fall 2026',
    assignments: [
      {
        title: 'Integration Worksheet',
        type: 'homework',
        status: 'in_progress',
        dueInDays: 1,
      },
      {
        title: 'Chapter 5 Reading',
        type: 'reading',
        status: 'todo',
        dueInDays: 4,
      },
    ],
  },
  {
    name: 'World History',
    color: '#22c55e',
    term: 'Fall 2026',
    assignments: [
      {
        title: 'Essay: Industrial Revolution',
        type: 'project',
        status: 'todo',
        dueInDays: 5,
        description: '1500 words on the social impact of industrialization.',
      },
      {
        title: 'Reading: Chapter 12',
        type: 'reading',
        status: 'todo',
        dueInDays: 9,
      },
    ],
  },
];

const demoQuests = [
  {
    title: 'Study 30 minutes today',
    difficulty: 'easy',
    status: 'todo',
    dueInDays: 0,
    estimatedMinutes: 30,
  },
  {
    title: 'Review CS flashcards',
    difficulty: 'medium',
    status: 'todo',
    dueInDays: 2,
    estimatedMinutes: 45,
  },
  {
    title: 'Finish the Calc worksheet',
    difficulty: 'hard',
    status: 'in_progress',
    dueInDays: 1,
    estimatedMinutes: 90,
  },
];

const demoPet = {
  name: 'Pixel',
  xp: 420,
  level: 3,
  stage: 'hatchling',
  streakCount: 3,
  lastStudyDate: daysFromNow(0),
};

/**
 * Reseed only when it would actually change something.
 *
 * The seed is destructive — it drops the demo user's courses, quests and pet
 * and rebuilds them — so running it per request was both the expensive half of
 * the amplification and a way to yank data out from under anyone mid-demo. A
 * fresh or emptied database still seeds immediately; a busy one seeds at most
 * once per cooldown.
 */
async function seedDemoPlannerIfStale(userId: string) {
  const courseCount = await prisma.course.count({ where: { userId } });
  const isEmpty = courseCount === 0;

  if (!isEmpty && Date.now() - lastSeededAt < RESEED_COOLDOWN_MS) {
    return;
  }

  await seedDemoPlanner(userId);
  lastSeededAt = Date.now();
}

async function seedDemoPlanner(userId: string) {
  await prisma.course.deleteMany({ where: { userId } });
  await prisma.quest.deleteMany({ where: { userId } });
  await prisma.pet.deleteMany({ where: { userId } });

  for (const course of demoCourses) {
    await prisma.course.create({
      data: {
        userId,
        name: course.name,
        color: course.color,
        term: course.term,
        assignments: {
          create: course.assignments.map((assignment) => ({
            title: assignment.title,
            description: assignment.description ?? null,
            type: assignment.type,
            status: assignment.status,
            dueAt: daysFromNow(assignment.dueInDays),
          })),
        },
      },
    });
  }

  await prisma.quest.createMany({
    data: demoQuests.map((quest) => ({
      userId,
      title: quest.title,
      difficulty: quest.difficulty,
      xpReward:
        quest.difficulty === 'easy' ? 5 : quest.difficulty === 'hard' ? 15 : 10,
      status: quest.status,
      dueAt: daysFromNow(quest.dueInDays),
      estimatedMinutes: quest.estimatedMinutes,
      rewardClaimed: quest.status === 'done',
    })),
  });

  await prisma.pet.create({
    data: {
      userId,
      ...demoPet,
    },
  });
}

/**
 * Constant-time compare of two hex tokens.
 *
 * timingSafeEqual throws on a length mismatch, so that is checked first — and
 * the length itself is not secret.
 */
function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Double-submit CSRF: the token must appear both in a cookie on this origin and
 * in the request body. A cross-site page can set neither, so it cannot make the
 * pair agree — which is the whole defence for a state-changing endpoint that
 * takes no credentials.
 */
function csrfTokenAccepted(bodyToken: unknown): boolean {
  const cookieToken = cookies().get(CSRF_COOKIE)?.value;
  if (!cookieToken || typeof bodyToken !== 'string') return false;
  // Long enough that a guess isn't worth attempting; the client sends 32 bytes.
  if (cookieToken.length < 32) return false;
  return tokensMatch(cookieToken, bodyToken);
}

/**
 * Drop all but the newest MAX_DEMO_SESSIONS live demo sessions.
 *
 * Newest-first so the row reuse is about to pick up is never the one deleted.
 */
async function trimExcessDemoSessions(userId: string) {
  const excess = await prisma.session.findMany({
    where: { userId },
    orderBy: { expires: 'desc' },
    skip: MAX_DEMO_SESSIONS,
    select: { id: true },
  });

  if (excess.length === 0) return;

  await prisma.session.deleteMany({
    where: { id: { in: excess.map((session) => session.id) } },
  });
}

/**
 * A demo session shared by everyone currently trying the app.
 *
 * The demo user is already a single shared identity, so a session row per
 * request bought nothing and grew the table without bound. One live row is
 * reused until it nears expiry; expired ones are swept on the way past.
 */
async function getOrCreateDemoSession(userId: string) {
  await prisma.session.deleteMany({
    where: { userId, expires: { lt: new Date() } },
  });

  await trimExcessDemoSessions(userId);

  const reusable = await prisma.session.findFirst({
    where: {
      userId,
      expires: { gt: new Date(Date.now() + SESSION_REUSE_MIN_REMAINING_MS) },
    },
    orderBy: { expires: 'desc' },
    select: { sessionToken: true, expires: true },
  });

  if (reusable) return reusable;

  // A NextAuth database session is just a random token + expiry tied to a user.
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });

  return { sessionToken, expires };
}

/**
 * GET is gone deliberately. A state-changing GET is exactly what let a
 * cross-site link install a demo session, so it now tells the caller where the
 * real entry point is instead of doing anything.
 */
export async function GET() {
  return jsonError(
    'Start the demo from the "Try the demo" button on the home page.',
    405
  );
}

export async function POST(request: Request) {
  try {
    return await handleDemoLogin(request);
  } catch (error) {
    console.error('POST /api/demo-login', error);
    return jsonError('Demo login is temporarily unavailable', 500);
  }
}

async function handleDemoLogin(request: Request) {
  const body = await request.json().catch(() => null);

  if (!csrfTokenAccepted((body as { csrfToken?: unknown } | null)?.csrfToken)) {
    return jsonError('Demo session request could not be verified', 403);
  }

  // Checked before any database work — the point is that a burst costs the
  // database nothing, not that it eventually fails.
  const limit = rateLimit(
    `demo-login:${clientIp(request)}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS
  );
  if (!limit.ok) {
    const res = jsonError(
      'Too many demo sessions from this network. Try again shortly.',
      429
    );
    res.headers.set('Retry-After', String(limit.retryAfterSeconds));
    return res;
  }

  // Upsert so the demo works even on a fresh DB that hasn't been seeded.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    // Ensure the demo user is always "onboarded" so it skips the first-run
    // onboarding gate and lands straight on the dashboard.
    update: { onboardedAt: new Date() },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      emailVerified: new Date(),
      timezone: 'America/Los_Angeles',
      onboardedAt: new Date(),
    },
  });

  await seedDemoPlannerIfStale(user.id);

  const { sessionToken, expires } = await getOrCreateDemoSession(user.id);

  // On HTTPS, NextAuth reads the __Secure- prefixed cookie; match that exactly
  // so getServerSession() picks up the session we just created.
  const useSecure = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
  const cookieName = useSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  // JSON rather than a redirect: the caller is fetch(), and it navigates itself
  // once the cookie is set.
  const res = jsonOk({ redirectTo: '/dashboard' });
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecure,
    expires,
  });
  // The CSRF token has done its job; don't leave it lying around.
  res.cookies.set(CSRF_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
