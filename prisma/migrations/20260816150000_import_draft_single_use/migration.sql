-- One-shot permission for a planner import confirmation, so a confirmation
-- cannot be replayed into repeated bulk writes.
--
-- Any preview sitting on a user's screen when this runs has no draft row, so
-- that one confirmation will be rejected and the plan needs re-parsing. Nothing
-- already saved is affected.

CREATE TABLE "ImportDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plannerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportDraft_userId_idx" ON "ImportDraft"("userId");
CREATE INDEX "ImportDraft_expiresAt_idx" ON "ImportDraft"("expiresAt");

ALTER TABLE "ImportDraft" ADD CONSTRAINT "ImportDraft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
