// Read models for the admin console.
//
// Every figure the console shows is assembled here rather than in the pages, so
// the "how many users" on the overview and the "how many users" in the user
// list cannot drift apart, and so the expensive shapes stay in one place.
//
// The recurring problem below is the N+1: a page of 25 users needs each one's
// last sign-in, live session count, and AI spend, and asking per user is 75
// extra round trips. Each list function therefore fetches its page of users,
// then issues one batched query per column and stitches the results together in
// memory.

import { DAILY_GENERATION_LIMIT } from '@/lib/ai/entitlement';
import { localDayKey } from '@/lib/local-day';
import { prisma } from '@/lib/prisma';
import type { AuthEventType, Prisma, UserRole } from '@prisma/client';

/** Rows per page across the console's tables. */
export const ADMIN_PAGE_SIZE = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

/**
 * Bytes an account occupies on disk.
 *
 * Two sources: PDF attachments that belong to a note (Note.pdfBytes) and
 * uploads written but not yet attached (PendingUpload.byteSize, swept after a
 * couple of hours). Both are recorded numbers, so this is a database sum — the
 * sizes are deliberately not stat()-ed here, or listing twenty-five accounts
 * would mean hundreds of filesystem round trips per page render.
 *
 * `unknownAttachments` counts attachments whose size was never captured. They
 * are reported separately rather than folded in as zero, because zero would
 * assert the account uses no storage when the honest answer is that we do not
 * know.
 */
export type StorageUsage = {
  attachmentBytes: number;
  pendingBytes: number;
  totalBytes: number;
  attachments: number;
  unknownAttachments: number;
};

/** The account's effective daily allowance — mirrors ai/entitlement.ts. */
function effectiveLimit(override: number | null): number {
  return typeof override === 'number' && override > 0
    ? override
    : DAILY_GENERATION_LIMIT;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type AdminOverview = {
  totalUsers: number;
  admins: number;
  suspended: number;
  onboarded: number;
  newUsers7d: number;
  newUsers30d: number;
  activeSessions: number;
  signIns24h: number;
  failedAttempts24h: number;
  signIns7d: number;
  aiGenerationsToday: number;
  aiGenerations30d: number;
  usersWithAiUsageToday: number;
  mfaEnabledUsers: number;
  storageBytes: number;
  pendingStorageBytes: number;
  storedAttachments: number;
  unknownSizeAttachments: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const now = new Date();
  // AiUsage.day is the *user's* local day, so a single server-side key can miss
  // an account a few hours either side of the date line. Both adjacent keys are
  // counted, which is right for the overwhelmingly common case of one deployment
  // serving one or two neighbouring time zones, and never undercounts.
  const todayKeys = [
    localDayKey(now),
    localDayKey(new Date(now.getTime() - DAY_MS)),
  ];

  const [
    totalUsers,
    admins,
    suspended,
    onboarded,
    newUsers7d,
    newUsers30d,
    activeSessions,
    signIns24h,
    failedAttempts24h,
    signIns7d,
    aiToday,
    ai30d,
    mfaEnabledUsers,
    attachmentTotals,
    unknownSizeAttachments,
    pendingTotals,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.user.count({ where: { onboardedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.session.count({ where: { expires: { gt: now } } }),
    prisma.authEvent.count({
      where: { type: 'SIGN_IN', createdAt: { gte: daysAgo(1) } },
    }),
    prisma.authEvent.count({
      where: {
        type: { in: ['SIGN_IN_FAILED', 'MFA_FAILED'] },
        createdAt: { gte: daysAgo(1) },
      },
    }),
    prisma.authEvent.count({
      where: { type: 'SIGN_IN', createdAt: { gte: daysAgo(7) } },
    }),
    prisma.aiUsage.aggregate({
      where: { day: { in: todayKeys } },
      _sum: { count: true },
      _count: { userId: true },
    }),
    prisma.aiUsage.aggregate({
      where: { day: { gte: localDayKey(daysAgo(30)) } },
      _sum: { count: true },
    }),
    // "Has a second factor" = TOTP activated or at least one passkey. Counted
    // with a relation filter rather than two queries and a union, which would
    // double-count anyone using both.
    prisma.user.count({
      where: {
        OR: [
          { totpActivatedAt: { not: null } },
          { authenticators: { some: {} } },
        ],
      },
    }),
    prisma.note.aggregate({
      where: { pdfBytes: { not: null } },
      _sum: { pdfBytes: true },
      _count: { _all: true },
    }),
    prisma.note.count({ where: { pdfUrl: { not: null }, pdfBytes: null } }),
    prisma.pendingUpload.aggregate({ _sum: { byteSize: true } }),
  ]);

  return {
    totalUsers,
    admins,
    suspended,
    onboarded,
    newUsers7d,
    newUsers30d,
    activeSessions,
    signIns24h,
    failedAttempts24h,
    signIns7d,
    aiGenerationsToday: aiToday._sum.count ?? 0,
    aiGenerations30d: ai30d._sum.count ?? 0,
    usersWithAiUsageToday: aiToday._count.userId ?? 0,
    mfaEnabledUsers,
    storageBytes:
      (attachmentTotals._sum.pdfBytes ?? 0) +
      (pendingTotals._sum.byteSize ?? 0),
    pendingStorageBytes: pendingTotals._sum.byteSize ?? 0,
    storedAttachments: attachmentTotals._count._all ?? 0,
    unknownSizeAttachments,
  };
}

// ---------------------------------------------------------------------------
// User list
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  suspendedAt: Date | null;
  createdAt: Date;
  onboardedAt: Date | null;
  timezone: string | null;
  lastSignInAt: Date | null;
  activeSessions: number;
  aiUsedToday: number;
  aiLimit: number;
  hasOverride: boolean;
  mfaEnabled: boolean;
  storageBytes: number;
  unknownAttachments: number;
};

export type AdminUserList = {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdminUserFilter = 'all' | 'admins' | 'suspended' | 'mfa';

export async function listAdminUsers(options: {
  query?: string;
  page?: number;
  filter?: AdminUserFilter;
}): Promise<AdminUserList> {
  const page = Math.max(1, options.page ?? 1);
  const search = options.query?.trim();

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (options.filter === 'admins') where.role = 'ADMIN';
  if (options.filter === 'suspended') where.suspendedAt = { not: null };
  if (options.filter === 'mfa') {
    where.OR = [
      { totpActivatedAt: { not: null } },
      { authenticators: { some: {} } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        suspendedAt: true,
        createdAt: true,
        onboardedAt: true,
        timezone: true,
        totpActivatedAt: true,
        aiDailyLimitOverride: true,
        _count: { select: { authenticators: true } },
      },
    }),
  ]);

  const ids = users.map((user) => user.id);
  const now = new Date();

  // Each user's own "today", so the AI figure matches what they see in their
  // sidebar rather than the server's idea of the date.
  const dayByUser = new Map(
    users.map((user) => [user.id, localDayKey(now, user.timezone)])
  );

  const [
    lastSignIns,
    sessionCounts,
    usageRows,
    attachmentRows,
    pendingRows,
    unknownRows,
  ] = await Promise.all([
    ids.length
      ? prisma.authEvent.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, type: 'SIGN_IN' },
          _max: { createdAt: true },
        })
      : [],
    ids.length
      ? prisma.session.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, expires: { gt: now } },
          _count: { _all: true },
        })
      : [],
    ids.length
      ? prisma.aiUsage.findMany({
          where: {
            userId: { in: ids },
            day: { in: Array.from(new Set(dayByUser.values())) },
          },
          select: { userId: true, day: true, count: true },
        })
      : [],
    // Storage, batched the same way as everything else on this page: one
    // grouped query per source rather than two per row.
    ids.length
      ? prisma.note.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, pdfBytes: { not: null } },
          _sum: { pdfBytes: true },
        })
      : [],
    ids.length
      ? prisma.pendingUpload.groupBy({
          by: ['userId'],
          where: { userId: { in: ids } },
          _sum: { byteSize: true },
        })
      : [],
    ids.length
      ? prisma.note.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, pdfUrl: { not: null }, pdfBytes: null },
          _count: { _all: true },
        })
      : [],
  ]);

  const lastSignInByUser = new Map(
    lastSignIns.map((row) => [row.userId, row._max.createdAt])
  );
  const sessionsByUser = new Map(
    sessionCounts.map((row) => [row.userId, row._count._all])
  );
  const usageByUser = new Map(
    usageRows
      .filter((row) => dayByUser.get(row.userId) === row.day)
      .map((row) => [row.userId, row.count])
  );
  const attachmentBytesByUser = new Map(
    attachmentRows.map((row) => [row.userId, row._sum.pdfBytes ?? 0])
  );
  const pendingBytesByUser = new Map(
    pendingRows.map((row) => [row.userId, row._sum.byteSize ?? 0])
  );
  const unknownByUser = new Map(
    unknownRows.map((row) => [row.userId, row._count._all])
  );

  return {
    rows: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      suspendedAt: user.suspendedAt,
      createdAt: user.createdAt,
      onboardedAt: user.onboardedAt,
      timezone: user.timezone,
      lastSignInAt: lastSignInByUser.get(user.id) ?? null,
      activeSessions: sessionsByUser.get(user.id) ?? 0,
      aiUsedToday: usageByUser.get(user.id) ?? 0,
      aiLimit: effectiveLimit(user.aiDailyLimitOverride),
      hasOverride: user.aiDailyLimitOverride !== null,
      mfaEnabled:
        user.totpActivatedAt !== null || user._count.authenticators > 0,
      storageBytes:
        (attachmentBytesByUser.get(user.id) ?? 0) +
        (pendingBytesByUser.get(user.id) ?? 0),
      unknownAttachments: unknownByUser.get(user.id) ?? 0,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// One user
// ---------------------------------------------------------------------------

export type AdminUserDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetail>>
>;

export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      onboardedAt: true,
      emailVerified: true,
      timezone: true,
      totpActivatedAt: true,
      aiDailyLimitOverride: true,
      pet: { select: { name: true } },
      _count: {
        select: {
          authenticators: true,
          courses: true,
          notes: true,
          quizzes: true,
          flashcards: true,
          groupMemberships: true,
          personalEvents: true,
        },
      },
    },
  });

  if (!user) return null;

  const now = new Date();
  const day = localDayKey(now, user.timezone);

  const [sessions, events, usage, todayUsage, attachments, pendingUploads] =
    await Promise.all([
      prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          expires: true,
          mfaVerifiedAt: true,
          impersonatedByUserId: true,
        },
      }),
      prisma.authEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          type: true,
          method: true,
          ip: true,
          userAgent: true,
          detail: true,
          createdAt: true,
        },
      }),
      prisma.aiUsage.findMany({
        where: {
          userId,
          day: { gte: localDayKey(daysAgo(30), user.timezone) },
        },
        orderBy: { day: 'asc' },
        select: { day: true, count: true },
      }),
      prisma.aiUsage.findUnique({
        where: { userId_day: { userId, day } },
        select: { count: true },
      }),
      // Listed rather than summed: a detail page can afford to name the files,
      // and "which note is holding 9 MB" is the question that actually follows
      // from seeing a large number.
      prisma.note.findMany({
        where: { userId, pdfUrl: { not: null } },
        orderBy: { pdfBytes: { sort: 'desc', nulls: 'last' } },
        select: { id: true, title: true, pdfName: true, pdfBytes: true },
      }),
      prisma.pendingUpload.findMany({
        where: { userId },
        select: { id: true, byteSize: true, expiresAt: true },
      }),
    ]);

  const attachmentBytes = attachments.reduce(
    (sum, row) => sum + (row.pdfBytes ?? 0),
    0
  );
  const pendingBytes = pendingUploads.reduce(
    (sum, row) => sum + row.byteSize,
    0
  );

  return {
    ...user,
    storage: {
      attachmentBytes,
      pendingBytes,
      totalBytes: attachmentBytes + pendingBytes,
      attachments: attachments.length,
      unknownAttachments: attachments.filter((row) => row.pdfBytes === null)
        .length,
    } satisfies StorageUsage,
    attachments,
    pendingUploads,
    mfaEnabled: user.totpActivatedAt !== null || user._count.authenticators > 0,
    aiLimit: effectiveLimit(user.aiDailyLimitOverride),
    aiUsedToday: todayUsage?.count ?? 0,
    aiUsed30d: usage.reduce((sum, row) => sum + row.count, 0),
    aiHistory: usage,
    sessions: sessions.map((session) => ({
      ...session,
      expired: session.expires <= now,
      // Session.createdAt was added after these rows existed, so the migration
      // stamped every pre-existing session with the migration time. A session
      // cannot have been created after it expired, so that comparison is a
      // reliable tell — without it the UI reads "started 27 minutes ago,
      // expired 23 days ago", which is nonsense the operator has to decode.
      createdAtKnown: session.createdAt < session.expires,
    })),
    events,
  };
}

// ---------------------------------------------------------------------------
// Global activity feed
// ---------------------------------------------------------------------------

export type AuthActivityFilter = 'all' | 'success' | 'failures';

export async function listAuthActivity(options: {
  page?: number;
  query?: string;
  filter?: AuthActivityFilter;
}) {
  const page = Math.max(1, options.page ?? 1);
  const search = options.query?.trim();

  const where: Prisma.AuthEventWhereInput = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { ip: { contains: search, mode: 'insensitive' } },
    ];
  }

  const failureTypes: AuthEventType[] = ['SIGN_IN_FAILED', 'MFA_FAILED'];
  if (options.filter === 'failures') where.type = { in: failureTypes };
  if (options.filter === 'success') where.type = { notIn: failureTypes };

  const [total, rows] = await Promise.all([
    prisma.authEvent.count({ where }),
    prisma.authEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        method: true,
        email: true,
        ip: true,
        userAgent: true,
        detail: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// AI quota analytics
// ---------------------------------------------------------------------------

export type AiQuotaAnalytics = Awaited<ReturnType<typeof getAiQuotaAnalytics>>;

/**
 * Who is spending the AI allowance, and how the whole deployment trends.
 *
 * Built entirely from the existing AiUsage day counters — no new metering — so
 * it is exact about generations per account per day and says nothing about
 * tokens or cost, which are not recorded anywhere.
 */
export async function getAiQuotaAnalytics(days = 30) {
  const since = localDayKey(daysAgo(days));

  const [daily, perUser] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ['day'],
      where: { day: { gte: since } },
      _sum: { count: true },
      _count: { userId: true },
      orderBy: { day: 'asc' },
    }),
    prisma.aiUsage.groupBy({
      by: ['userId'],
      where: { day: { gte: since } },
      _sum: { count: true },
      orderBy: { _sum: { count: 'desc' } },
      take: 20,
    }),
  ]);

  const ids = perUser.map((row) => row.userId);
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          email: true,
          timezone: true,
          aiDailyLimitOverride: true,
        },
      })
    : [];

  const userById = new Map(users.map((user) => [user.id, user]));
  const now = new Date();

  // Today's spend for exactly the users on this leaderboard, so the "x of y
  // today" column doesn't need a query each.
  const todayRows = ids.length
    ? await prisma.aiUsage.findMany({
        where: {
          userId: { in: ids },
          day: {
            in: Array.from(
              new Set(users.map((user) => localDayKey(now, user.timezone)))
            ),
          },
        },
        select: { userId: true, day: true, count: true },
      })
    : [];

  const todayByUser = new Map(
    todayRows
      .filter(
        (row) =>
          localDayKey(now, userById.get(row.userId)?.timezone) === row.day
      )
      .map((row) => [row.userId, row.count])
  );

  const topUsers = perUser
    .map((row) => {
      const user = userById.get(row.userId);
      if (!user) return null;

      const limit = effectiveLimit(user.aiDailyLimitOverride);
      const usedToday = todayByUser.get(row.userId) ?? 0;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        total: row._sum.count ?? 0,
        usedToday,
        limit,
        hasOverride: user.aiDailyLimitOverride !== null,
        percentOfLimitToday: Math.min(
          100,
          Math.round((usedToday / limit) * 100)
        ),
        atLimit: usedToday >= limit,
      };
    })
    // A row whose user was deleted is dropped rather than rendered as a blank.
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    days,
    daily: daily.map((row) => ({
      day: row.day,
      total: row._sum.count ?? 0,
      users: row._count.userId,
    })),
    topUsers,
    totalGenerations: daily.reduce(
      (sum, row) => sum + (row._sum.count ?? 0),
      0
    ),
    defaultLimit: DAILY_GENERATION_LIMIT,
    usersAtLimitToday: topUsers.filter((row) => row.atLimit).length,
  };
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export async function listAdminAudit(options: { page?: number }) {
  const page = Math.max(1, options.page ?? 1);

  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        actorEmail: true,
        targetEmail: true,
        targetUserId: true,
        action: true,
        detail: true,
        ip: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}
