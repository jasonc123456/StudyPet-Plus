-- Two-phase TOTP enrollment: a replacement secret is staged here and only
-- promoted into "totpSecret" once the user proves possession, so re-enrolling
-- can no longer clear the account's working second factor.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpPendingSecret" TEXT;

-- Any secret that was still pending under the old single-column scheme (secret
-- written, never activated) moves to the staging column so it keeps working.
UPDATE "User"
SET "totpPendingSecret" = "totpSecret",
    "totpSecret" = NULL
WHERE "totpSecret" IS NOT NULL
  AND "totpActivatedAt" IS NULL;
