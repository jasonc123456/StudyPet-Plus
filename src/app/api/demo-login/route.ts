// One-click demo login — no email round-trip.
//
// StudyPet+ uses passwordless magic-link auth, so there's no password to post.
// Instead this handler mints a real database-backed NextAuth session for the
// shared demo user and sets the session cookie, exactly like a normal sign-in
// would. `auth()` (getServerSession) then resolves it on every page.
//
// Reached via the "🚀 Try the demo" button on the landing page.

import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';

// Always run on the server per request — never cache (it sets a cookie).
export const dynamic = 'force-dynamic';

const DEMO_EMAIL = 'demo@studypetplus.corecrafted.net';
const DEMO_NAME = 'Demo Student';
const SESSION_DAYS = 30;

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
  xp: 120,
  level: 2,
  stage: 'hatchling',
  streakCount: 3,
  lastStudyDate: daysFromNow(0),
};

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
    })),
  });

  await prisma.pet.create({
    data: {
      userId,
      ...demoPet,
    },
  });
}

export async function GET(request: Request) {
  // Upsert so the demo works even on a fresh DB that hasn't been seeded.
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: DEMO_NAME, emailVerified: new Date() },
  });

  await seedDemoPlanner(user.id);

  // A NextAuth database session is just a random token + expiry tied to a user.
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  // On HTTPS, NextAuth reads the __Secure- prefixed cookie; match that exactly
  // so getServerSession() picks up the session we just created.
  const useSecure = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
  const cookieName = useSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  // Redirect to the dashboard on the canonical site origin.
  const base = process.env.NEXTAUTH_URL ?? request.url;
  const res = NextResponse.redirect(new URL('/dashboard', base));
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecure,
    expires,
  });
  return res;
}
