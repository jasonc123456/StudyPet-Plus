// Prisma seed — demo accounts + planner data for StudyPet+.
//
// StudyPet+ uses passwordless magic-link auth, so a "demo account" is just a
// User row (there is no password to set). This script:
//   1. Upserts a few email-verified demo users (idempotent — safe to re-run).
//   2. Seeds Sprint 2 planner data (courses, assignments, quests, pet) for the
//      primary demo user so the dashboard is populated for demos (idempotent —
//      the user's planner rows are cleared and rebuilt on each run).
//   3. Mints one ready-to-use Session for the primary demo user and prints the
//      cookie, so you can log in INSTANTLY in a browser without the email
//      round-trip (handy for demos / local testing).
//
// Run with:  npx prisma db seed     (wired via the "prisma.seed" key in package.json)

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

// Demo users. Add/edit freely — emails must be unique.
const demoUsers = [
  { email: 'demo@studypetplus.corecrafted.net', name: 'Demo Student' },
  { email: 'student@studypetplus.corecrafted.net', name: 'Sample Student' },
];

// How long the instant-login demo session stays valid.
const SESSION_DAYS = 30;

// Due date helper: a Date `days` from now (fractional days OK), midday so tz
// wobble never shifts it across a day boundary in the dashboard's week window.
function daysFromNow(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// Demo planner data for the primary user. Colors/statuses/types match the
// allowed values in src/lib/constants.ts so seeded rows look native in the UI.
const demoCourses = [
  {
    name: 'Intro to Computer Science',
    color: '#6366f1', // Indigo
    term: 'Fall 2026',
    assignments: [
      { title: 'Problem Set 3', type: 'homework', status: 'todo', dueInDays: 2 },
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
    color: '#eab308', // Yellow
    term: 'Fall 2026',
    assignments: [
      {
        title: 'Integration Worksheet',
        type: 'homework',
        status: 'in_progress',
        dueInDays: 1,
      },
      { title: 'Chapter 5 Reading', type: 'reading', status: 'todo', dueInDays: 4 },
    ],
  },
  {
    name: 'World History',
    color: '#22c55e', // Green
    term: 'Fall 2026',
    assignments: [
      {
        title: 'Essay: Industrial Revolution',
        type: 'project',
        status: 'todo',
        dueInDays: 5,
        description: '1500 words on the social impact of industrialization.',
      },
      { title: 'Reading: Chapter 12', type: 'reading', status: 'todo', dueInDays: 9 },
    ],
  },
];

const demoQuests = [
  { title: 'Study 30 minutes today', xpReward: 10, status: 'todo', dueInDays: 0 },
  { title: 'Review CS flashcards', xpReward: 15, status: 'todo', dueInDays: 2 },
  {
    title: 'Finish the Calc worksheet',
    xpReward: 20,
    status: 'in_progress',
    dueInDays: 1,
  },
];

// Static placeholder pet (live XP/streak/evolution logic lands in Sprint 4).
const demoPet = {
  name: 'Pixel',
  xp: 120,
  level: 2,
  stage: 'hatchling',
  streakCount: 3,
  lastStudyDate: daysFromNow(0),
};

// Seed the planner data for one user. Idempotent: wipe this user's existing
// courses (assignments cascade), quests, and pet, then recreate from scratch.
async function seedPlanner(user) {
  await prisma.course.deleteMany({ where: { userId: user.id } });
  await prisma.quest.deleteMany({ where: { userId: user.id } });
  await prisma.pet.deleteMany({ where: { userId: user.id } });

  for (const c of demoCourses) {
    await prisma.course.create({
      data: {
        userId: user.id,
        name: c.name,
        color: c.color,
        term: c.term,
        assignments: {
          create: c.assignments.map((a) => ({
            title: a.title,
            description: a.description ?? null,
            type: a.type,
            status: a.status,
            dueAt: daysFromNow(a.dueInDays),
          })),
        },
      },
    });
  }

  await prisma.quest.createMany({
    data: demoQuests.map((q) => ({
      userId: user.id,
      title: q.title,
      xpReward: q.xpReward,
      status: q.status,
      dueAt: daysFromNow(q.dueInDays),
    })),
  });

  await prisma.pet.create({ data: { userId: user.id, ...demoPet } });

  const courseCount = demoCourses.length;
  const assignmentCount = demoCourses.reduce(
    (n, c) => n + c.assignments.length,
    0
  );
  console.log(
    `  ✓ planner  ${courseCount} courses, ${assignmentCount} assignments, ` +
      `${demoQuests.length} quests, 1 pet  for ${user.email}`
  );
}

async function main() {
  // 1) Upsert the demo users, marking them email-verified so auth treats them
  //    as fully signed-up accounts.
  const users = [];
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, emailVerified: new Date() },
      create: { email: u.email, name: u.name, emailVerified: new Date() },
    });
    users.push(user);
    console.log(`  ✓ user  ${user.email}  (${user.id})`);
  }

  // 2) Seed Sprint 2 planner data (courses, assignments, quests, pet) for the
  //    primary demo user so the dashboard is populated out of the box.
  const primary = users[0];
  await seedPlanner(primary);

  // 3) Mint an instant-login session for the FIRST demo user.
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { sessionToken, userId: primary.id, expires },
  });

  // On HTTPS (NEXTAUTH_URL=https://…), NextAuth uses the __Secure- cookie name.
  const isHttps = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
  const cookieName = isHttps
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  console.log('\n  Instant-login session for', primary.email);
  console.log('  ----------------------------------------------------------');
  console.log(
    '  Set this cookie in your browser (DevTools ▸ Application ▸ Cookies)'
  );
  console.log(`    name:   ${cookieName}`);
  console.log(`    value:  ${sessionToken}`);
  console.log(`    expires: ${expires.toISOString()}`);
  console.log("  Then open the site and you'll be signed in as the demo user.");
}

main()
  .then(() => console.log('\nSeed complete.'))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
