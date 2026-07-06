import { z } from 'zod';

import {
  ASSIGNMENT_STATUS_VALUES,
  ASSIGNMENT_TYPE_VALUES,
  COURSE_COLOR_VALUES,
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

const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUS_VALUES);
const assignmentTypeSchema = z.enum(ASSIGNMENT_TYPE_VALUES);

export const createCourseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  color: colorSchema,
  term: z.string().trim().max(50).optional().nullable(),
});

export const updateCourseSchema = createCourseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  status: assignmentStatusSchema,
  type: assignmentTypeSchema,
});

export const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    dueAt: z.string().datetime({ offset: true }).optional().nullable(),
    status: assignmentStatusSchema.optional(),
    type: assignmentTypeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

/** First human-readable message from a Zod safeParse failure. */
export function zodFirstError(
  error: z.ZodError,
  fallback = 'Invalid input'
): string {
  return error.issues[0]?.message ?? fallback;
}
