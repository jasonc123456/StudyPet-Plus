-- DropForeignKey
ALTER TABLE "Flashcard" DROP CONSTRAINT "Flashcard_noteId_fkey";

-- DropForeignKey
ALTER TABLE "Quiz" DROP CONSTRAINT "Quiz_noteId_fkey";

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "setId" TEXT,
ALTER COLUMN "noteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "title" TEXT,
ALTER COLUMN "noteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "hint" TEXT;

-- CreateTable
CREATE TABLE "FlashcardSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardSourceNote" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,

    CONSTRAINT "FlashcardSourceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSourceNote" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,

    CONSTRAINT "QuizSourceNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlashcardSet_userId_idx" ON "FlashcardSet"("userId");

-- CreateIndex
CREATE INDEX "FlashcardSet_courseId_idx" ON "FlashcardSet"("courseId");

-- CreateIndex
CREATE INDEX "FlashcardSourceNote_setId_idx" ON "FlashcardSourceNote"("setId");

-- CreateIndex
CREATE INDEX "FlashcardSourceNote_noteId_idx" ON "FlashcardSourceNote"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardSourceNote_setId_noteId_key" ON "FlashcardSourceNote"("setId", "noteId");

-- CreateIndex
CREATE INDEX "QuizSourceNote_quizId_idx" ON "QuizSourceNote"("quizId");

-- CreateIndex
CREATE INDEX "QuizSourceNote_noteId_idx" ON "QuizSourceNote"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizSourceNote_quizId_noteId_key" ON "QuizSourceNote"("quizId", "noteId");

-- CreateIndex
CREATE INDEX "Flashcard_setId_idx" ON "Flashcard"("setId");

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_setId_fkey" FOREIGN KEY ("setId") REFERENCES "FlashcardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardSet" ADD CONSTRAINT "FlashcardSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardSet" ADD CONSTRAINT "FlashcardSet_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardSourceNote" ADD CONSTRAINT "FlashcardSourceNote_setId_fkey" FOREIGN KEY ("setId") REFERENCES "FlashcardSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardSourceNote" ADD CONSTRAINT "FlashcardSourceNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSourceNote" ADD CONSTRAINT "QuizSourceNote_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSourceNote" ADD CONSTRAINT "QuizSourceNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
