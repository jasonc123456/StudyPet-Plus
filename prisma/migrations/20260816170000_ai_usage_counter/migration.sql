-- Durable per-day AI generation counter.
--
-- The daily allowance was counted in process memory, so it reset on every
-- container restart. That is tolerable for an invisible guard rail but not for
-- a figure shown to the user in the sidebar, which would drop back to zero on
-- each deploy. Counting here also makes the number identical across replicas.
--
-- "day" is the user's own calendar day as "YYYY-MM-DD", so the allowance rolls
-- over at their local midnight. Existing in-memory counts are not migrated:
-- every account starts this release with a fresh allowance, which errs toward
-- the user.

CREATE TABLE "AiUsage" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    -- The pair is the identity. The claim path upserts on it from concurrent
    -- requests, so it is enforced here rather than by a read-then-write.
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("userId", "day")
);

CREATE INDEX "AiUsage_day_idx" ON "AiUsage"("day");

ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
