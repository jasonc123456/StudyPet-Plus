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
  { email: 'demo@studypetplus.app', name: 'Demo Student' },
  { email: 'student@studypetplus.app', name: 'Sample Student' },
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
    color: '#eab308', // Yellow
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

// Static placeholder pet (live XP/streak/evolution logic lands in Sprint 4).
const demoPet = {
  name: 'Pixel',
  xp: 420,
  level: 3,
  stage: 'hatchling',
  streakCount: 3,
  lastStudyDate: daysFromNow(0),
};

// Demo notes tied to seeded courses (source text for future AI generation).
const demoNotes = [
  {
    courseName: 'Intro to Computer Science',
    title: 'Week 3: Variables & Types',
    content:
      'Variables store data. Primitive types include int, float, bool, and string. Use meaningful names and declare types explicitly in statically typed languages.',
  },
  {
    courseName: 'Calculus II',
    title: 'Integration techniques',
    content:
      'U-substitution reverses the chain rule. Integration by parts: ∫u dv = uv − ∫v du. Practice identifying which technique fits each integral.',
  },
  {
    courseName: null,
    title: 'General study tips',
    content:
      'Review notes within 24 hours of lecture. Break study sessions into 25-minute blocks with short breaks.',
  },
];

const demoGradeScale = [
  { label: 'A+', minPercent: 95, maxPercent: 100, gpaPoints: 4.0 },
  { label: 'A', minPercent: 90, maxPercent: 94.99, gpaPoints: 4.0 },
  { label: 'A-', minPercent: 87, maxPercent: 89.99, gpaPoints: 3.7 },
  { label: 'B+', minPercent: 83, maxPercent: 86.99, gpaPoints: 3.3 },
  { label: 'B', minPercent: 80, maxPercent: 82.99, gpaPoints: 3.0 },
  { label: 'B-', minPercent: 77, maxPercent: 79.99, gpaPoints: 2.7 },
  { label: 'C+', minPercent: 73, maxPercent: 76.99, gpaPoints: 2.3 },
  { label: 'C', minPercent: 70, maxPercent: 72.99, gpaPoints: 2.0 },
  { label: 'D', minPercent: 60, maxPercent: 69.99, gpaPoints: 1.0 },
  { label: 'F', minPercent: 0, maxPercent: 59.99, gpaPoints: 0 },
];

const demoGradeCategories = [
  {
    courseName: 'Intro to Computer Science',
    name: 'Homework',
    weight: 35,
    items: [
      {
        assignmentTitle: 'Hello World Lab',
        title: 'HW 1',
        scoreEarned: 98,
        scorePossible: 100,
      },
    ],
  },
  {
    courseName: 'Intro to Computer Science',
    name: 'Exams',
    weight: 40,
    items: [
      {
        assignmentTitle: 'Midterm Exam',
        title: 'Midterm',
        scoreEarned: 88,
        scorePossible: 100,
      },
    ],
  },
  {
    courseName: 'Calculus II',
    name: 'Homework',
    weight: 25,
    items: [
      {
        assignmentTitle: 'Integration Worksheet',
        title: 'Worksheet 1',
        scoreEarned: 18,
        scorePossible: 20,
      },
    ],
  },
  {
    courseName: 'World History',
    name: 'Essays',
    weight: 50,
    items: [
      {
        assignmentTitle: 'Essay: Industrial Revolution',
        title: 'Essay 1',
        scoreEarned: 92,
        scorePossible: 100,
      },
    ],
  },
];

const demoCoursePlanner = {
  title: 'UCSC Long-Term Plan',
  system: 'QUARTER',
  sections: [
    {
      label: 'Fall 2026',
      courses: [
        {
          title: 'Intro to Computer Science',
          courseNumber: 'CSE115A',
          units: 5,
          professor: 'Prof. Nguyen',
          lectureDays: 'Mon/Wed',
          lectureTime: '2:00 PM - 3:45 PM',
          lectureLocation: 'Engineering 2 Room 101',
          isAlternate: false,
        },
        {
          title: 'Discrete Mathematics',
          courseNumber: 'MATH19A',
          units: 5,
          professor: 'Prof. Alvarez',
          lectureDays: 'Tue/Thu',
          lectureTime: '10:40 AM - 12:15 PM',
          lectureLocation: 'Online',
          isAlternate: true,
          notes: 'Backup if first-choice schedule conflicts.',
        },
      ],
    },
    {
      label: 'Winter 2027',
      courses: [
        {
          title: 'Data Structures',
          courseNumber: 'CSE101',
          units: 5,
          professor: 'Prof. Patel',
          lectureDays: 'Mon/Wed/Fri',
          lectureTime: '11:30 AM - 12:35 PM',
          lectureLocation: 'Baskin 156',
          isAlternate: false,
        },
      ],
    },
    {
      label: 'Spring 2027',
      courses: [
        {
          title: 'Computer Systems',
          courseNumber: 'CSE120',
          units: 5,
          professor: 'Prof. Kim',
          lectureDays: 'Tue/Thu',
          lectureTime: '1:30 PM - 3:05 PM',
          lectureLocation: 'Engineering 2 Room 192',
          isAlternate: false,
        },
      ],
    },
  ],
};

// Seed the planner data for one user. Idempotent: wipe this user's existing
// courses (assignments cascade), quests, and pet, then recreate from scratch.
async function seedPlanner(user) {
  await prisma.coursePlanner.deleteMany({ where: { userId: user.id } });
  await prisma.course.deleteMany({ where: { userId: user.id } });
  await prisma.quest.deleteMany({ where: { userId: user.id } });
  await prisma.note.deleteMany({ where: { userId: user.id } });
  await prisma.pet.deleteMany({ where: { userId: user.id } });
  await prisma.gradeScaleEntry.deleteMany({ where: { userId: user.id } });
  await prisma.gradeProfile.deleteMany({ where: { userId: user.id } });

  const courseIdsByName = new Map();
  const assignmentIdsByCourseAndTitle = new Map();

  for (const c of demoCourses) {
    const course = await prisma.course.create({
      data: {
        userId: user.id,
        name: c.name,
        color: c.color,
        term: c.term,
        credits: 4,
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
      include: {
        assignments: {
          select: { id: true, title: true },
        },
      },
    });

    courseIdsByName.set(c.name, course.id);
    for (const assignment of course.assignments) {
      assignmentIdsByCourseAndTitle.set(
        `${c.name}::${assignment.title}`,
        assignment.id
      );
    }
  }

  await prisma.quest.createMany({
    data: demoQuests.map((q) => ({
      userId: user.id,
      title: q.title,
      difficulty: q.difficulty,
      xpReward: q.difficulty === 'easy' ? 5 : q.difficulty === 'hard' ? 15 : 10,
      status: q.status,
      dueAt: daysFromNow(q.dueInDays),
      estimatedMinutes: q.estimatedMinutes,
      rewardClaimed: q.status === 'done',
    })),
  });

  await prisma.pet.create({ data: { userId: user.id, ...demoPet } });

  for (const note of demoNotes) {
    let courseId = null;
    if (note.courseName) {
      const course = await prisma.course.findFirst({
        where: { userId: user.id, name: note.courseName },
        select: { id: true },
      });
      courseId = course?.id ?? null;
    }

    await prisma.note.create({
      data: {
        userId: user.id,
        courseId,
        title: note.title,
        content: note.content,
      },
    });
  }

  await prisma.gradeProfile.create({
    data: {
      userId: user.id,
      currentGpa: 3.62,
      completedCredits: 58,
    },
  });

  await prisma.gradeScaleEntry.createMany({
    data: demoGradeScale.map((entry, index) => ({
      userId: user.id,
      label: entry.label,
      minPercent: entry.minPercent,
      maxPercent: entry.maxPercent,
      gpaPoints: entry.gpaPoints,
      sortOrder: index,
    })),
  });

  for (const category of demoGradeCategories) {
    const courseId = courseIdsByName.get(category.courseName);
    if (!courseId) continue;

    const createdCategory = await prisma.gradeCategory.create({
      data: {
        courseId,
        name: category.name,
        weight: category.weight,
      },
    });

    await prisma.gradeItem.createMany({
      data: category.items.map((item) => ({
        categoryId: createdCategory.id,
        assignmentId:
          assignmentIdsByCourseAndTitle.get(
            `${category.courseName}::${item.assignmentTitle}`
          ) ?? null,
        title: item.title,
        scoreEarned: item.scoreEarned,
        scorePossible: item.scorePossible,
        gradedAt: daysFromNow(-2),
      })),
    });
  }

  await prisma.coursePlanner.create({
    data: {
      userId: user.id,
      title: demoCoursePlanner.title,
      system: demoCoursePlanner.system,
      sections: {
        create: demoCoursePlanner.sections.map((section, index) => ({
          label: section.label,
          sortOrder: index,
          courses: {
            create: section.courses,
          },
        })),
      },
    },
  });

  const courseCount = demoCourses.length;
  const assignmentCount = demoCourses.reduce(
    (n, c) => n + c.assignments.length,
    0
  );
  console.log(
    `  ✓ planner  ${courseCount} courses, ${assignmentCount} assignments, ` +
      `${demoQuests.length} quests, ${demoNotes.length} notes, grade tracker, course planner, 1 pet  for ${user.email}`
  );
}

async function main() {
  // 1) Upsert the demo users, marking them email-verified so auth treats them
  //    as fully signed-up accounts.
  const users = [];
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      // Seeded users are pre-onboarded (timezone + onboardedAt set) so demos
      // skip the first-run onboarding gate.
      update: {
        name: u.name,
        emailVerified: new Date(),
        timezone: 'America/Los_Angeles',
        onboardedAt: new Date(),
      },
      create: {
        email: u.email,
        name: u.name,
        emailVerified: new Date(),
        timezone: 'America/Los_Angeles',
        onboardedAt: new Date(),
      },
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
