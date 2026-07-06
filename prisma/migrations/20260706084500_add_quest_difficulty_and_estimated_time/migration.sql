ALTER TABLE "Quest"
ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "estimatedMinutes" INTEGER;
