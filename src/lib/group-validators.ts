import { z } from 'zod';

const dueAtSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    const date = val instanceof Date ? val : new Date(val);
    return Number.isNaN(date.getTime()) ? null : date;
  });

const optionalTrimmedString = (max: number) =>
  z.string().trim().max(max).optional().nullable();

function extractInviteToken(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.searchParams.get('token')?.trim() || trimmed;
  } catch {
    return trimmed;
  }
}

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(100),
  description: optionalTrimmedString(1000),
});

export const updateGroupSchema = createGroupSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const createGroupInviteSchema = z.object({
  expiresAt: dueAtSchema,
  maxUses: z
    .union([z.coerce.number(), z.null(), z.undefined(), z.literal('')])
    .optional()
    .transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      return Number(val);
    })
    .refine(
      (val) =>
        val === null || (Number.isInteger(val) && val > 0 && val <= 1000),
      { message: 'Max uses must be between 1 and 1000' }
    ),
});

export const joinGroupSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Invite token is required')
    .max(500)
    .transform(extractInviteToken),
});

export const updateGroupMemberSchema = z
  .object({
    role: z.enum(['ADMIN', 'MEMBER']).optional(),
    customRoleId: z.string().trim().min(1).optional().nullable(),
  })
  .refine(
    (data) => data.role !== undefined || data.customRoleId !== undefined,
    {
      message: 'At least one field is required',
    }
  );

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{6})$/, 'Enter a valid 6-digit hex color');

export const createGroupCustomRoleSchema = z.object({
  name: z.string().trim().min(1, 'Role name is required').max(50),
  color: hexColorSchema.default('#2563eb'),
});

export const createGroupChannelSchema = z.object({
  name: z.string().trim().min(1, 'Channel name is required').max(50),
  description: optionalTrimmedString(500),
  position: z.coerce.number().int().min(0).max(10000).optional().default(0),
});

export const updateGroupChannelSchema = createGroupChannelSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const createGroupMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message is required').max(4000),
});

export const updateGroupMessageSchema = createGroupMessageSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const groupTaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

const assigneeIdsSchema = z.array(z.string().trim().min(1)).max(100).optional();

export const createGroupTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: optionalTrimmedString(2000),
  dueAt: dueAtSchema,
  status: groupTaskStatusSchema.optional().default('TODO'),
  channelId: z.string().trim().min(1).optional().nullable(),
  assigneeUserIds: assigneeIdsSchema.default([]),
});

export const updateGroupTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalTrimmedString(2000),
    dueAt: dueAtSchema,
    status: groupTaskStatusSchema.optional(),
    channelId: z.string().trim().min(1).optional().nullable(),
    assigneeUserIds: assigneeIdsSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export const updateGroupTaskAssigneesSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).max(100),
  replace: z.boolean().optional().default(true),
});
