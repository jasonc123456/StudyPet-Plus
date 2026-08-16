import { createHash, randomBytes } from 'node:crypto';

import { GroupInviteStatus, GroupRole, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRawInviteToken() {
  return randomBytes(24).toString('hex');
}

export function isGroupAdmin(role: GroupRole) {
  return role === GroupRole.OWNER || role === GroupRole.ADMIN;
}

export async function getGroupMembership(groupId: string, userId: string) {
  return prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

/**
 * Where-fragment for "task assignments this user may still see".
 *
 * A GroupTaskAssignee row points at the User, not at the membership, so it
 * outlives removal from the group. Reads that filtered on `userId` alone were
 * therefore treating a stale assignment as its own standing grant, and a removed
 * member kept receiving assigned tasks. Every read of assigned tasks spreads
 * this in, so current membership is re-checked at read time rather than trusted
 * to have been cleaned up at write time.
 */
export function assignedTaskWhere(userId: string) {
  return {
    userId,
    task: {
      group: {
        memberships: { some: { userId } },
      },
    },
  } satisfies Prisma.GroupTaskAssigneeWhereInput;
}

export async function getGroupById(groupId: string) {
  return prisma.studyGroup.findUnique({
    where: { id: groupId },
  });
}

export async function getGroupForMember(groupId: string, userId: string) {
  return prisma.studyGroup.findFirst({
    where: { id: groupId, memberships: { some: { userId } } },
  });
}

export async function getGroupChannel(groupId: string, channelId: string) {
  return prisma.groupChannel.findFirst({
    where: { id: channelId, groupId },
  });
}

export async function getGroupMessage(groupId: string, messageId: string) {
  return prisma.groupMessage.findFirst({
    where: { id: messageId, groupId },
  });
}

export async function getGroupTask(groupId: string, taskId: string) {
  return prisma.groupTask.findFirst({
    where: { id: taskId, groupId },
    include: { assignees: true },
  });
}

export async function getGroupInvite(groupId: string, inviteId: string) {
  return prisma.groupInvite.findFirst({
    where: { id: inviteId, groupId },
  });
}

export async function ensureGroupMembers(groupId: string, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return [];

  const memberships = await prisma.groupMembership.findMany({
    where: { groupId, userId: { in: uniqueUserIds } },
    select: { userId: true },
  });

  if (memberships.length !== uniqueUserIds.length) {
    const found = new Set(memberships.map((membership) => membership.userId));
    const missing = uniqueUserIds.filter((userId) => !found.has(userId));
    throw new Error(`These users are not in the group: ${missing.join(', ')}`);
  }

  return uniqueUserIds;
}

export function normalizeInviteStatus(invite: {
  status: GroupInviteStatus;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
}) {
  if (invite.status !== GroupInviteStatus.ACTIVE) {
    return invite.status;
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return GroupInviteStatus.EXPIRED;
  }
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return GroupInviteStatus.EXPIRED;
  }
  return GroupInviteStatus.ACTIVE;
}

export function isMissingGroupTables(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021' &&
    typeof error.message === 'string' &&
    (error.message.includes('StudyGroup') ||
      error.message.includes('GroupMembership') ||
      error.message.includes('GroupInvite') ||
      error.message.includes('GroupChannel') ||
      error.message.includes('GroupMessage') ||
      error.message.includes('GroupTask') ||
      error.message.includes('GroupTaskAssignee'))
  );
}

export function buildGroupSummary(group: {
  id: string;
  name: string;
  description: string | null;
  memberships: Array<{ role: GroupRole }>;
  _count?: { memberships: number; channels: number; tasks: number };
}) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    role: group.memberships[0]?.role ?? GroupRole.MEMBER,
    memberCount: group._count?.memberships ?? 0,
    channelCount: group._count?.channels ?? 0,
    taskCount: group._count?.tasks ?? 0,
  };
}
