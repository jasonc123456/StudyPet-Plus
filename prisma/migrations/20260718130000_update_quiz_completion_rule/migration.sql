-- Quiz attempts may be retried indefinitely. A client-generated attempt id
-- makes submission retries idempotent without blocking genuine retakes.
ALTER TABLE "QuizAttempt" ADD COLUMN "clientAttemptId" TEXT;

CREATE UNIQUE INDEX "QuizAttempt_userId_clientAttemptId_key"
ON "QuizAttempt"("userId", "clientAttemptId");

-- QuizXpAward now marks permanent perfect-score completion rather than a
-- once-per-day payout. Partial attempts are recorded only in QuizAttempt.
-- Preserve a marker only when that quiz actually has a perfect attempt.
DELETE FROM "QuizXpAward" AS award
WHERE NOT EXISTS (
    SELECT 1
    FROM "QuizAttempt" AS attempt
    WHERE attempt."userId" = award."userId"
      AND attempt."quizId" = award."quizId"
      AND attempt."correctCount" = attempt."totalQuestions"
      AND attempt."totalQuestions" > 0
);

-- The old daily rule may have produced multiple markers for a quiz. Keep the
-- earliest one before replacing the daily key with the permanent key.
DELETE FROM "QuizXpAward" AS newer
USING "QuizXpAward" AS older
WHERE newer."userId" = older."userId"
  AND newer."quizId" = older."quizId"
  AND (
      newer."createdAt" > older."createdAt"
      OR (
          newer."createdAt" = older."createdAt"
          AND newer."id" > older."id"
      )
  );

DROP INDEX "QuizXpAward_userId_quizId_awardedOn_key";

ALTER TABLE "QuizXpAward" DROP COLUMN "awardedOn";

CREATE UNIQUE INDEX "QuizXpAward_userId_quizId_key"
ON "QuizXpAward"("userId", "quizId");
