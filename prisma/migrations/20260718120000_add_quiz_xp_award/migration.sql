-- CreateTable
CREATE TABLE "QuizXpAward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "awardedOn" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizXpAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizXpAward_userId_idx" ON "QuizXpAward"("userId");

-- CreateIndex
CREATE INDEX "QuizXpAward_quizId_idx" ON "QuizXpAward"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizXpAward_userId_quizId_awardedOn_key" ON "QuizXpAward"("userId", "quizId", "awardedOn");

-- AddForeignKey
ALTER TABLE "QuizXpAward" ADD CONSTRAINT "QuizXpAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizXpAward" ADD CONSTRAINT "QuizXpAward_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
