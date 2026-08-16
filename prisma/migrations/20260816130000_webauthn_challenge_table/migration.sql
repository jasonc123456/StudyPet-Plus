-- WebAuthn ceremonies move off the single User.currentChallenge slot and into
-- one row per (session, ceremony), with an expiry and a hashed value.
--
-- Any ceremony in flight when this runs is abandoned — the browser gets
-- "Challenge expired, try again" and the user restarts. That is a few seconds of
-- inconvenience for whoever is mid-tap, not data loss.

CREATE TYPE "WebAuthnCeremony" AS ENUM ('AUTHENTICATION', 'REGISTRATION');

CREATE TABLE "WebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ceremony" "WebAuthnCeremony" NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebAuthnChallenge_sessionToken_ceremony_key"
    ON "WebAuthnChallenge"("sessionToken", "ceremony");
CREATE INDEX "WebAuthnChallenge_userId_idx" ON "WebAuthnChallenge"("userId");
CREATE INDEX "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");

ALTER TABLE "WebAuthnChallenge" ADD CONSTRAINT "WebAuthnChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN "currentChallenge";
