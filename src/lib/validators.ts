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

/**
 * True when `tz` is a time zone the JS runtime can actually format with.
 * Cheaper and more forward-proof than hardcoding an IANA list — the browser
 * only ever sends us zones from Intl.supportedValuesOf, and this rejects junk.
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Time zone is required')
  .max(64)
  .refine(isValidTimeZone, { message: 'Select a valid time zone' });

const colorSchema = z
  .string()
  .refine(
    (v) =>
      (COURSE_COLOR_VALUES as readonly string[]).includes(v) ||
      hexColorRegex.test(v),
    { message: 'Invalid color' }
  );

const courseSchemaFields = {
  name: z.string().trim().min(1, 'Name is required').max(100),
  color: colorSchema.optional().default(DEFAULT_COURSE_COLOR),
  term: z.string().trim().max(50).optional().nullable(),
  credits: z.coerce
    .number()
    .int()
    .min(0, 'Credits must be 0 or more')
    .max(12, 'Credits must be 12 or fewer')
    .optional()
    .default(3),
};

export const createCourseSchema = z.object(courseSchemaFields);

export const updateCourseSchema = z
  .object(courseSchemaFields)
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

// Canvas (and Apple/Google) often hand out a `webcal://` feed link. It's a real
// ICS URL, but Node's fetch only speaks http(s) — normalize it to https so the
// same link the user copies from Canvas just works.
const icsUrlSchema = z
  .string()
  .trim()
  .min(1, 'ICS URL is required')
  .max(2000)
  .transform((value) => value.replace(/^webcal:\/\//i, 'https://'))
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Enter a valid ICS feed URL (https:// or webcal://)' }
  );

export const createCalendarSubscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Calendar name is required').max(100),
  icsUrl: icsUrlSchema,
  color: z
    .string()
    .trim()
    .refine((value) => hexColorRegex.test(value), {
      message: 'Enter a full hex color like #0ea5e9',
    }),
  // Left un-defaulted on purpose: updateCalendarSubscriptionSchema is this
  // schema `.partial()`, and a default here would make an omitted autoSync parse
  // as `false` — turning a rename into an accidental "disable sync + delete the
  // synced assignments". Absent must stay absent. The POST route applies the
  // false default itself.
  autoSync: z.boolean().optional(),
});

export const updateCalendarSubscriptionSchema = createCalendarSubscriptionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// Ignoring a feed event addresses it by (subscription, uid) — the same key
// auto-sync uses to upsert assignments.
export const calendarIgnoreSchema = z.object({
  subscriptionId: z.string().trim().min(1, 'Calendar connection is required'),
  uid: z.string().trim().min(1, 'Event id is required').max(500),
  title: z.string().trim().max(300).optional().default('Untitled event'),
});

export const calendarSyncSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type CreateCalendarSubscriptionInput = z.infer<
  typeof createCalendarSubscriptionSchema
>;
export type UpdateCalendarSubscriptionInput = z.infer<
  typeof updateCalendarSubscriptionSchema
>;
export type CalendarIgnoreInput = z.infer<typeof calendarIgnoreSchema>;

const optionalCourseIdSchema = z
  .union([z.string().trim().min(1), z.null(), z.literal('')])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return val;
  });

const noteSchemaFields = {
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.string().max(50000).optional().default(''),
  courseId: optionalCourseIdSchema,
  pdfName: z.string().trim().min(1).max(255).optional().nullable(),
  pdfUrl: z
    .string()
    .trim()
    .startsWith('/api/notes/files/')
    .max(500)
    .optional()
    .nullable(),
  pdfToken: z.string().trim().length(64).optional().nullable(),
};

type NotePdfShape = typeof noteSchemaFields;

function addNotePdfConsistencyCheck(
  data: { pdfName?: string | null; pdfUrl?: string | null },
  ctx: z.RefinementCtx
) {
  const hasPdfName = Boolean(data.pdfName);
  const hasPdfUrl = Boolean(data.pdfUrl);

  if (hasPdfName !== hasPdfUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PDF name and file reference must be saved together',
      path: hasPdfName ? ['pdfUrl'] : ['pdfName'],
    });
  }
}

const createNoteSchemaBase = z.object(noteSchemaFields);
const updateNoteSchemaBase = z.object(noteSchemaFields).partial();

export const createNoteSchema = createNoteSchemaBase.superRefine(
  (data, ctx) => {
    addNotePdfConsistencyCheck(data, ctx);
  }
);

export const updateNoteSchema = updateNoteSchemaBase
  .superRefine((data, ctx) => {
    addNotePdfConsistencyCheck(data, ctx);
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

const nonNegativeNumberSchema = z.coerce.number().min(0);

export const updateGradeProfileSchema = z.object({
  currentGpa: z
    .union([z.coerce.number(), z.null(), z.literal('')])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null;
      return Number(value);
    })
    .refine((value) => value === null || (value >= 0 && value <= 4.3), {
      message: 'Current GPA must be between 0.0 and 4.3',
    }),
  completedCredits: z.coerce
    .number()
    .min(0, 'Completed credits must be 0 or more')
    .max(400, 'Completed credits must be 400 or fewer'),
});

export const createGradeScaleEntrySchema = z
  .object({
    label: z.string().trim().min(1, 'Letter grade is required').max(20),
    minPercent: z.coerce
      .number()
      .min(0, 'Minimum percent must be 0 or more')
      .max(100, 'Minimum percent must be 100 or less'),
    maxPercent: z.coerce
      .number()
      .min(0, 'Maximum percent must be 0 or more')
      .max(100, 'Maximum percent must be 100 or less'),
    gpaPoints: z.coerce
      .number()
      .min(0, 'GPA points must be 0 or more')
      .max(4.3, 'GPA points must be 4.3 or less'),
  })
  .refine((data) => data.minPercent <= data.maxPercent, {
    message: 'Minimum percent must be less than or equal to maximum percent',
    path: ['minPercent'],
  });

export const createGradeCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  weight: z.coerce
    .number()
    .gt(0, 'Weight must be greater than 0')
    .max(100, 'Weight must be 100 or less'),
});

export const updateGradeCategorySchema = createGradeCategorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const createGradeItemSchema = z.object({
  title: z.string().trim().min(1, 'Item name is required').max(150),
  assignmentId: z
    .union([z.string().trim().min(1), z.null(), z.literal('')])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null;
      return value;
    }),
  scoreEarned: nonNegativeNumberSchema.refine((value) => value <= 100000, {
    message: 'Earned points are too large',
  }),
  scorePossible: z.coerce
    .number()
    .gt(0, 'Possible points must be greater than 0')
    .max(100000, 'Possible points are too large'),
  notes: z.string().trim().max(2000).optional().nullable(),
  gradedAt: z
    .union([z.string(), z.date(), z.null(), z.literal('')])
    .optional()
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }),
});

export type UpdateGradeProfileInput = z.infer<typeof updateGradeProfileSchema>;
export type CreateGradeScaleEntryInput = z.infer<
  typeof createGradeScaleEntrySchema
>;
export type CreateGradeCategoryInput = z.infer<
  typeof createGradeCategorySchema
>;
export type UpdateGradeCategoryInput = z.infer<
  typeof updateGradeCategorySchema
>;
export type CreateGradeItemInput = z.infer<typeof createGradeItemSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Valid email is required').max(255),
  petName: z.string().trim().min(1, 'StudyPet name is required').max(50),
  image: z
    .string()
    .trim()
    .regex(profileImagePathRegex, 'Select one of the default profile pictures'),
  timezone: timezoneSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// First-run onboarding: name + time zone + avatar. Other profile details
// (email, pet name, theme) are completed later in Settings.
export const onboardingSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  timezone: timezoneSchema,
  image: z
    .string()
    .trim()
    .regex(profileImagePathRegex, 'Select one of the default profile pictures'),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** First human-readable message from a Zod safeParse failure. */
export function zodFirstError(
  error: z.ZodError,
  fallback = 'Invalid input'
): string {
  return error.issues[0]?.message ?? fallback;
}
