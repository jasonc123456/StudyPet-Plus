import { z } from 'zod';

import {
  ASSIGNMENT_STATUS_VALUES,
  ASSIGNMENT_TYPE_VALUES,
  COURSE_COLOR_VALUES,
  DEFAULT_ASSIGNMENT_STATUS,
  DEFAULT_ASSIGNMENT_TYPE,
  DEFAULT_COURSE_COLOR,
} from '@/lib/constants';

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

const assignmentStatusSchema = z.enum(
  ASSIGNMENT_STATUS_VALUES as [string, ...string[]]
);

const assignmentTypeSchema = z.enum(
  ASSIGNMENT_TYPE_VALUES as [string, ...string[]]
);

const dueAtSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    const date = val instanceof Date ? val : new Date(val);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  dueAt: dueAtSchema,
  status: assignmentStatusSchema.optional().default(DEFAULT_ASSIGNMENT_STATUS),
  type: assignmentTypeSchema.optional().default(DEFAULT_ASSIGNMENT_TYPE),
});

export const updateAssignmentSchema = createAssignmentSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

/** First human-readable message from a Zod safeParse failure. */
export function zodFirstError(
  error: z.ZodError,
  fallback = 'Invalid input'
): string {
  return error.issues[0]?.message ?? fallback;
}
