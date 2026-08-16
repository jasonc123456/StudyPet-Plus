-- Durable throttling state for TOTP challenge guessing.
-- Additive and backfilled with the "no failures yet" default, so applying this
-- ahead of the new build changes nothing for existing accounts.
ALTER TABLE "User" ADD COLUMN     "totpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
                  ADD COLUMN     "totpLockedUntil" TIMESTAMP(3);
