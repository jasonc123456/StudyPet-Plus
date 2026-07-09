import { jsonError, jsonOk, requireUser } from '@/lib/api-response';
import { createGroupCustomRoleSchema } from '@/lib/group-validators';
import { getGroupMembership, isGroupAdmin } from '@/lib/groups';
import { prisma } from '@/lib/prisma';
import { zodFirstError } from '@/lib/validators';

type RouteContext = {
  params: { groupId: string };
};

export async function GET(_request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);

  const roles = await prisma.groupCustomRole.findMany({
    where: { groupId: params.groupId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  });

  return jsonOk(roles);
}

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireUser();
  if (authResult instanceof Response) return authResult;

  const membership = await getGroupMembership(
    params.groupId,
    authResult.user.id
  );
  if (!membership) return jsonError('Group not found', 404);
  if (!isGroupAdmin(membership.role)) {
    return jsonError('Only admins can create custom roles', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createGroupCustomRoleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(zodFirstError(parsed.error), 400);
  }

  const existing = await prisma.groupCustomRole.findFirst({
    where: {
      groupId: params.groupId,
      name: parsed.data.name,
    },
    select: { id: true },
  });
  if (existing) {
    return jsonError('A role with that name already exists', 409);
  }

  const customRole = await prisma.groupCustomRole.create({
    data: {
      groupId: params.groupId,
      name: parsed.data.name,
      color: parsed.data.color,
    },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
    },
  });

  return jsonOk(customRole, 201);
}
