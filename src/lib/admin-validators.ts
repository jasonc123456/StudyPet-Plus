import { z } from 'zod';

/**
 * Request shapes for the admin console.
 *
 * The destructive operations all demand an explicit confirmation field rather
 * than relying on the UI to have asked. A console that can delete an account
 * should not be one stray fetch away from doing so, and a confirmation the
 * server checks survives someone wiring up their own client.
 */

/** Partial update of one account. Every field is independently optional. */
export const updateAdminUserSchema = z
  .object({
    role: z.enum(['USER', 'ADMIN']).optional(),
    suspended: z.boolean().optional(),
    suspendedReason: z.string().trim().max(500).optional().nullable(),
    // null clears the override and returns the account to the deployment
    // default; a number sets it. Capped so a typo can't hand out a limit that
    // is effectively unlimited.
    aiDailyLimitOverride: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      value.role !== undefined ||
      value.suspended !== undefined ||
      value.aiDailyLimitOverride !== undefined,
    { message: 'Nothing to update' }
  );

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

/**
 * Deleting an account. `confirmEmail` must match the target's address exactly —
 * the same pattern as GitHub's repository deletion, and the only thing standing
 * between a misclick and an irreversible cascade across the user's notes,
 * quizzes, groups, and files.
 */
export const deleteAdminUserSchema = z.object({
  confirmEmail: z.string().trim().min(1, 'Type the account email to confirm'),
});

export const impersonateSchema = z.object({
  userId: z.string().trim().min(1, 'A user is required'),
  acknowledge: z.literal(true, {
    message: 'Impersonation must be acknowledged',
  }),
});
