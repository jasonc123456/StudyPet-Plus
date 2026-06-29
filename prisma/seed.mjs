// Prisma seed — demo accounts for StudyPet+.
//
// StudyPet+ uses passwordless magic-link auth, so a "demo account" is just a
// User row (there is no password to set). This script:
//   1. Upserts a few email-verified demo users (idempotent — safe to re-run).
//   2. Mints one ready-to-use Session for the primary demo user and prints the
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

  // 2) Mint an instant-login session for the FIRST demo user.
  const primary = users[0];
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
