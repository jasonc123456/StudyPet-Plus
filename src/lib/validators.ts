import { z } from 'zod';

import { COURSE_COLOR_VALUES, DEFAULT_COURSE_COLOR } from '@/lib/constants';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const colorSchema = z
  .string()
  .refine(
    (v) =>
      (COURSE_COLOR_VALUES as readonly string[]).includes(v) ||
      hexColorRegex.test(v),
    { message: 'Invalid color' }
  );

export const createCourseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  color: colorSchema.optional().default(DEFAULT_COURSE_COLOR),
  term: z.string().trim().max(50).optional().nullable(),
});

export const updateCourseSchema = createCourseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

/** First human-readable message from a Zod safeParse failure. */
export function zodFirstError(
  error: z.ZodError,
  fallback = 'Invalid input'
): string {
  return error.issues[0]?.message ?? fallback;
}
