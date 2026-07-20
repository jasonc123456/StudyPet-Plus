-- AlterTable
ALTER TABLE "QuizQuestion" ADD COLUMN     "choiceRationales" TEXT[] DEFAULT ARRAY[]::TEXT[];
