ALTER TABLE "Course" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN "archiveReason" TEXT;

CREATE INDEX "Course_userId_archivedAt_idx" ON "Course"("userId", "archivedAt");
