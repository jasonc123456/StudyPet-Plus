-- Track note attachments that are on disk but not yet attached to a note, so
-- they can be budgeted per user and swept when abandoned.
--
-- Files already sitting in the temporary directory when this runs have no row
-- and so are never swept by age; they are bounded, pre-existing, and cleaned up
-- by hand if needed. Everything uploaded from here on is tracked.

CREATE TABLE "PendingUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PendingUpload_userId_idx" ON "PendingUpload"("userId");
CREATE INDEX "PendingUpload_expiresAt_idx" ON "PendingUpload"("expiresAt");

ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
