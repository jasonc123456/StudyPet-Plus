// Single-use permission to run one planner import confirmation.
//
// Confirming an import creates up to 600 planned courses in one transaction.
// The per-request size was capped, but the request itself could be replayed as
// often as the caller liked, so a small repeated POST turned into unbounded
// database growth and repeated long transactions. Parsing a plan now issues a
// token; confirming spends it.

import { prisma } from '@/lib/prisma';

/** Long enough to review and edit a parsed plan, short enough to expire. */
const DRAFT_TTL_MS = 60 * 60 * 1000;

/** Ceiling on how many planned courses one planner may hold. */
export const MAX_COURSES_PER_PLANNER = 2_000;

/** Issue a draft token for a planner the caller owns. */
export async function issueImportDraft(
  userId: string,
  plannerId: string
): Promise<string> {
  const draft = await prisma.importDraft.create({
    data: {
      userId,
      plannerId,
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    },
    select: { id: true },
  });

  // Opportunistic cleanup of drafts nobody confirmed.
  await prisma.importDraft.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return draft.id;
}

/**
 * Spend a draft token, returning whether it was valid.
 *
 * The delete is the check: it either removes exactly one matching row or it
 * doesn't, so two confirmations racing the same token cannot both proceed.
 */
export async function consumeImportDraft(
  draftId: string,
  userId: string,
  plannerId: string
): Promise<boolean> {
  const { count } = await prisma.importDraft.deleteMany({
    where: {
      id: draftId,
      userId,
      plannerId,
      expiresAt: { gt: new Date() },
    },
  });

  return count === 1;
}
