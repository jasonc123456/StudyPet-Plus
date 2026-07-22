-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendarFeedTokenHash" TEXT;

-- CreateTable
CREATE TABLE "PersonalEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarFeedTokenHash_key" ON "User"("calendarFeedTokenHash");

-- CreateIndex
CREATE INDEX "PersonalEvent_userId_idx" ON "PersonalEvent"("userId");

-- CreateIndex
CREATE INDEX "PersonalEvent_startsAt_idx" ON "PersonalEvent"("startsAt");

-- AddForeignKey
ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
