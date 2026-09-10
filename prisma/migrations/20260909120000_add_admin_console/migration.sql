-- Admin console: application roles, an authentication event log, and an
-- audit trail for admin actions.
--
-- Three gaps this closes.
--
-- 1. There was no notion of an application administrator. Group membership had
--    roles, the account itself did not, so "who may see every user" had no
--    answer in the database. User.role is that answer; it defaults to USER, so
--    this migration grants nobody anything.
--
-- 2. Authentication left no history. A Session row says who is signed in now,
--    it is replaced on the next sign-in, it records no origin, and a *failed*
--    attempt never created one at all. AuthEvent records each attempt with its
--    address and user agent. Existing sessions cannot be backfilled into it —
--    the information was never captured — so the log legitimately starts empty
--    and only covers sign-ins from this release onward.
--
-- 3. The console can delete and impersonate accounts. AdminAuditLog keeps who
--    did that and to whom. Both of its user references are ON DELETE SET NULL
--    with the email stored alongside, so removing either party leaves the
--    record intact rather than cascading away the evidence. AuthEvent.userId is
--    SET NULL for the same reason.

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

CREATE TYPE "AuthEventType" AS ENUM (
    'SIGN_IN',
    'SIGN_IN_FAILED',
    'SIGN_OUT',
    'MFA_SUCCESS',
    'MFA_FAILED',
    'IMPERSONATION_START',
    'IMPERSONATION_END'
);

CREATE TYPE "AdminActionType" AS ENUM (
    'ROLE_GRANTED',
    'ROLE_REVOKED',
    'USER_SUSPENDED',
    'USER_UNSUSPENDED',
    'USER_DELETED',
    'SESSIONS_REVOKED',
    'MFA_RESET',
    'AI_LIMIT_OVERRIDDEN',
    'IMPERSONATION_START',
    'IMPERSONATION_END'
);

ALTER TABLE "User"
    ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
    ADD COLUMN "suspendedAt" TIMESTAMP(3),
    ADD COLUMN "suspendedReason" TEXT,
    ADD COLUMN "aiDailyLimitOverride" INTEGER;

-- Existing rows get the migration timestamp rather than their true creation
-- time, which was never stored. Wrong but harmless: these sessions age out
-- within the session lifetime and the column is only used for display+sorting.
ALTER TABLE "Session"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "impersonatedByUserId" TEXT;

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "AuthEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "type" "AuthEventType" NOT NULL,
    "method" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthEvent_userId_createdAt_idx" ON "AuthEvent"("userId", "createdAt");
CREATE INDEX "AuthEvent_createdAt_idx" ON "AuthEvent"("createdAt");
CREATE INDEX "AuthEvent_type_createdAt_idx" ON "AuthEvent"("type", "createdAt");
CREATE INDEX "AuthEvent_email_createdAt_idx" ON "AuthEvent"("email", "createdAt");

ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "action" "AdminActionType" NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");
CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
