-- AlterTable
ALTER TABLE "CalendarSubscription" ADD COLUMN     "autoSync" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "calendarSubscriptionId" TEXT,
ADD COLUMN     "externalUid" TEXT;

-- CreateTable
CREATE TABLE "CalendarIgnoredEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarIgnoredEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarIgnoredEvent_subscriptionId_idx" ON "CalendarIgnoredEvent"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIgnoredEvent_subscriptionId_uid_key" ON "CalendarIgnoredEvent"("subscriptionId", "uid");

-- CreateIndex
CREATE INDEX "Assignment_calendarSubscriptionId_idx" ON "Assignment"("calendarSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_calendarSubscriptionId_externalUid_key" ON "Assignment"("calendarSubscriptionId", "externalUid");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_calendarSubscriptionId_fkey" FOREIGN KEY ("calendarSubscriptionId") REFERENCES "CalendarSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIgnoredEvent" ADD CONSTRAINT "CalendarIgnoredEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CalendarSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
