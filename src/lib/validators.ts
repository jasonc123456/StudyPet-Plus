import { z } from 'zod';

import {
  ASSIGNMENT_STATUS_VALUES,
  ASSIGNMENT_TYPE_VALUES,
  COURSE_COLOR_VALUES,
  DEFAULT_ASSIGNMENT_STATUS,
  DEFAULT_ASSIGNMENT_TYPE,
  DEFAULT_COURSE_COLOR,
  DEFAULT_QUEST_DIFFICULTY,
  DEFAULT_QUEST_STATUS,
  QUEST_DIFFICULTY_VALUES,
  QUEST_STATUS_VALUES,
  QUEST_XP_BY_DIFFICULTY,
} from '@/lib/constants';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const profileImagePathRegex = /^\/profile-pics\/(?:[1-9]|10)\.png$/;

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

const questStatusSchema = z.enum(QUEST_STATUS_VALUES as [string, ...string[]]);
const questDifficultySchema = z.enum(
  QUEST_DIFFICULTY_VALUES as [string, ...string[]]
);
const estimatedMinutesSchema = z
  .union([z.coerce.number(), z.null(), z.undefined(), z.literal('')])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return Number(val);
  })
  .refine(
    (val) =>
      val === null || (Number.isInteger(val) && val >= 0 && val <= 24 * 60),
    { message: 'Estimated time must be between 0 and 1440 minutes' }
  );

const questSchemaFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  dueAt: dueAtSchema,
  status: questStatusSchema.optional().default(DEFAULT_QUEST_STATUS),
  difficulty: questDifficultySchema
    .optional()
    .default(DEFAULT_QUEST_DIFFICULTY),
  estimatedMinutes: estimatedMinutesSchema,
};

const createQuestSchemaBase = z.object(questSchemaFields);
const updateQuestSchemaBase = z.object(questSchemaFields).partial();

export const createQuestSchema = createQuestSchemaBase.transform((data) => ({
  ...data,
  xpReward: QUEST_XP_BY_DIFFICULTY[data.difficulty],
}));

export const updateQuestSchema = updateQuestSchemaBase
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })
  .transform((data) => ({
    ...data,
    ...(data.difficulty !== undefined && {
      xpReward: QUEST_XP_BY_DIFFICULTY[data.difficulty],
    }),
  }));

export type CreateQuestInput = z.infer<typeof createQuestSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

export const createCalendarSubscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Calendar name is required').max(100),
  icsUrl: z.string().trim().url('Valid ICS URL is required').max(2000),
  color: z
    .string()
    .trim()
    .refine((value) => hexColorRegex.test(value), {
      message: 'Enter a full hex color like #0ea5e9',
    }),
});

export const updateCalendarSubscriptionSchema = createCalendarSubscriptionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type CreateCalendarSubscriptionInput = z.infer<
  typeof createCalendarSubscriptionSchema
>;
export type UpdateCalendarSubscriptionInput = z.infer<
  typeof updateCalendarSubscriptionSchema
>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Valid email is required').max(255),
  petName: z.string().trim().min(1, 'StudyPet name is required').max(50),
  image: z
    .string()
    .trim()
    .regex(profileImagePathRegex, 'Select one of the default profile pictures'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** First human-readable message from a Zod safeParse failure. */
export function zodFirstError(
  error: z.ZodError,
  fallback = 'Invalid input'
): string {
  return error.issues[0]?.message ?? fallback;
}
