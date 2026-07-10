-- AlterTable
ALTER TABLE "Course" ADD COLUMN "credits" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "GradeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentGpa" DOUBLE PRECISION,
    "completedCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeScaleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercent" DOUBLE PRECISION NOT NULL,
    "maxPercent" DOUBLE PRECISION NOT NULL,
    "gpaPoints" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeScaleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeCategory" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "title" TEXT NOT NULL,
    "scoreEarned" DOUBLE PRECISION NOT NULL,
    "scorePossible" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeProfile_userId_key" ON "GradeProfile"("userId");

-- CreateIndex
CREATE INDEX "GradeScaleEntry_userId_idx" ON "GradeScaleEntry"("userId");

-- CreateIndex
CREATE INDEX "GradeScaleEntry_userId_sortOrder_idx" ON "GradeScaleEntry"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GradeCategory_courseId_name_key" ON "GradeCategory"("courseId", "name");

-- CreateIndex
CREATE INDEX "GradeCategory_courseId_idx" ON "GradeCategory"("courseId");

-- CreateIndex
CREATE INDEX "GradeItem_categoryId_idx" ON "GradeItem"("categoryId");

-- CreateIndex
CREATE INDEX "GradeItem_assignmentId_idx" ON "GradeItem"("assignmentId");

-- AddForeignKey
ALTER TABLE "GradeProfile" ADD CONSTRAINT "GradeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeScaleEntry" ADD CONSTRAINT "GradeScaleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeCategory" ADD CONSTRAINT "GradeCategory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
