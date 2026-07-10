-- CreateEnum
CREATE TYPE "AcademicSystem" AS ENUM ('SEMESTER', 'QUARTER');

-- CreateTable
CREATE TABLE "CoursePlanner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "system" "AcademicSystem" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePlanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePlannerSection" (
    "id" TEXT NOT NULL,
    "plannerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoursePlannerSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedCourse" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseNumber" TEXT,
    "units" DOUBLE PRECISION,
    "professor" TEXT,
    "lectureDays" TEXT,
    "lectureTime" TEXT,
    "lectureLocation" TEXT,
    "isAlternate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoursePlanner_userId_idx" ON "CoursePlanner"("userId");

-- CreateIndex
CREATE INDEX "CoursePlannerSection_plannerId_idx" ON "CoursePlannerSection"("plannerId");

-- CreateIndex
CREATE INDEX "CoursePlannerSection_plannerId_sortOrder_idx" ON "CoursePlannerSection"("plannerId", "sortOrder");

-- CreateIndex
CREATE INDEX "PlannedCourse_sectionId_idx" ON "PlannedCourse"("sectionId");

-- CreateIndex
CREATE INDEX "PlannedCourse_sectionId_isAlternate_idx" ON "PlannedCourse"("sectionId", "isAlternate");

-- AddForeignKey
ALTER TABLE "CoursePlanner" ADD CONSTRAINT "CoursePlanner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePlannerSection" ADD CONSTRAINT "CoursePlannerSection_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "CoursePlanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CoursePlannerSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
