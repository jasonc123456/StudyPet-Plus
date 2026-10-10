-- CreateTable
CREATE TABLE "CalendarTrackedEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarTrackedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarTrackedEvent_subscriptionId_idx" ON "CalendarTrackedEvent"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarTrackedEvent_subscriptionId_uid_key" ON "CalendarTrackedEvent"("subscriptionId", "uid");

-- AddForeignKey
ALTER TABLE "CalendarTrackedEvent" ADD CONSTRAINT "CalendarTrackedEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CalendarSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
