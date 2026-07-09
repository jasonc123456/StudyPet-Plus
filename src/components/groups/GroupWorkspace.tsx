'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { DashboardPanel } from '@/components/dashboard/DashboardPanel';

type GroupWorkspaceProps = {
  currentUserId: string;
  group: {
    id: string;
    name: string;
    description: string | null;
    currentUserRole: string;
  };
  initialTab: string;
  initialSelectedChannelId: string | null;
  channels: Array<{
    id: string;
    name: string;
    description: string | null;
    position: number;
    createdAt: string;
  }>;
  members: Array<{
    id: string;
    role: string;
    customRole: {
      id: string;
      name: string;
      color: string;
    } | null;
    joinedAt: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
  customRoles: Array<{
    id: string;
    name: string;
    color: string;
    createdAt: string;
  }>;
  initialMessages: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorId: string;
    author: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dueAt: string | null;
    status: string;
    channel: { id: string; name: string } | null;
    createdBy: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
    assignees: Array<{
      user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
    }>;
  }>;
  invites: Array<{
    id: string;
    status: string;
    normalizedStatus: string;
    expiresAt: string | null;
    maxUses: number | null;
    useCount: number;
    createdAt: string;
  }>;
};

type GroupMessage = GroupWorkspaceProps['initialMessages'][number];
type GroupTask = GroupWorkspaceProps['tasks'][number];
type GroupMember = GroupWorkspaceProps['members'][number];
type GroupInvite = GroupWorkspaceProps['invites'][number];

const TAB_OPTIONS = [
  { value: 'chat', label: 'Chat' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'members', label: 'Members' },
  { value: 'invites', label: 'Invites' },
] as const;

function formatDateTimeUTC(value: string | null) {
  if (!value) return 'No due date';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return 'No due date';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDateUTC(value: string | null) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatShortDateLocal(value: string | null) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeUTC(value: string | null) {
  if (!value) return 'All day';
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function formatTimeLocal(value: string | null) {
  if (!value) return 'All day';
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthTitleUTC(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function monthTitleLocal(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function buildMonthGrid(month: Date) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const days: Date[] = [];
  for (const cursor = new Date(gridStart); cursor <= gridEnd;) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function displayName(user: {
  name: string | null;
  email: string | null;
  id: string;
}) {
  return user.name || user.email || user.id;
}

function displayRole(member: GroupMember) {
  return member.customRole?.name || member.role;
}

function roleBadgeStyle(member: GroupMember) {
  return member.customRole
    ? {
        backgroundColor: `${member.customRole.color}20`,
        color: member.customRole.color,
        borderColor: `${member.customRole.color}40`,
      }
    : undefined;
}

function Avatar({
  user,
  size = 'md',
}: {
  user: GroupMember['user'];
  size?: 'sm' | 'md';
}) {
  const initials = displayName(user).slice(0, 2).toUpperCase();
  const classes = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-10 w-10 text-sm';

  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={displayName(user)}
        className={`${classes} rounded-full object-cover ring-1 ring-slate-200`}
      />
    );
  }

  return (
    <div
      className={`${classes} flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ring-1 ring-slate-200`}
    >
      {initials}
    </div>
  );
}

function DateLabel({
  value,
  mode,
  mounted,
}: {
  value: string | null;
  mode: 'dateTime' | 'shortDate' | 'time';
  mounted: boolean;
}) {
  const text =
    mode === 'dateTime'
      ? mounted
        ? formatDateTimeLocal(value)
        : formatDateTimeUTC(value)
      : mode === 'shortDate'
        ? mounted
          ? formatShortDateLocal(value)
          : formatShortDateUTC(value)
        : mounted
          ? formatTimeLocal(value)
          : formatTimeUTC(value);

  return <span suppressHydrationWarning>{text}</span>;
}

export function GroupWorkspace({
  currentUserId,
  group,
  initialTab,
  initialSelectedChannelId,
  channels: initialChannels,
  members: initialMembers,
  customRoles: initialCustomRoles,
  initialMessages,
  tasks: initialTasks,
  invites: initialInvites,
}: GroupWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedTab, setSelectedTab] = useState(initialTab || 'chat');
  const [selectedChannelId, setSelectedChannelId] = useState(
    initialSelectedChannelId
  );
  const [mounted, setMounted] = useState(false);
  const [channels, setChannels] = useState(initialChannels);
  const [members, setMembers] = useState(initialMembers);
  const [customRoles, setCustomRoles] = useState(initialCustomRoles);
  const [tasks, setTasks] = useState(initialTasks);
  const [invites, setInvites] = useState(initialInvites);
  const [messagesByChannel, setMessagesByChannel] = useState<
    Record<string, GroupMessage[]>
  >(
    initialSelectedChannelId
      ? { [initialSelectedChannelId]: initialMessages }
      : {}
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    status: 'TODO',
    channelId: '',
    assigneeUserIds: [] as string[],
  });
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [creatingCustomRole, setCreatingCustomRole] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [inviteForm, setInviteForm] = useState({ expiresAt: '', maxUses: '' });
  const [customRoleForm, setCustomRoleForm] = useState({
    name: '',
    color: '#2563eb',
  });
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const isAdmin =
    group.currentUserRole === 'OWNER' || group.currentUserRole === 'ADMIN';
  const isOwner = group.currentUserRole === 'OWNER';
  const activeChannelId = selectedChannelId || channels[0]?.id || null;
  const activeMessages = activeChannelId
    ? messagesByChannel[activeChannelId] || []
    : [];
  const membersByUserId = members.reduce<Record<string, GroupMember>>(
    (acc, member) => {
      acc[member.user.id] = member;
      return acc;
    },
    {}
  );
  const calendarDays = buildMonthGrid(calendarMonth);
  const dueTasks = tasks.filter((task) => task.dueAt);
  const tasksByDay = dueTasks.reduce<Record<string, GroupTask[]>>(
    (acc, task) => {
      const key = getDayKey(new Date(task.dueAt as string));
      acc[key] ??= [];
      acc[key].push(task);
      return acc;
    },
    {}
  );

  function syncQuery(nextTab: string, nextChannelId?: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);

    if (nextChannelId) {
      params.set('channel', nextChannelId);
    } else {
      params.delete('channel');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!activeChannelId || messagesByChannel[activeChannelId]) {
      return;
    }

    const channelId = activeChannelId;
    let cancelled = false;

    async function loadMessages() {
      setLoadingMessages(true);
      setWorkspaceError(null);

      try {
        const response = await fetch(
          `/api/groups/${group.id}/channels/${channelId}/messages`
        );
        const data = (await response.json().catch(() => null)) as
          GroupMessage[] | { error: string } | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !Array.isArray(data)) {
          setWorkspaceError(
            !Array.isArray(data) && data?.error
              ? data.error
              : 'Unable to load messages'
          );
          return;
        }

        setMessagesByChannel((current) => ({
          ...current,
          [channelId]: data,
        }));
      } catch {
        if (!cancelled) {
          setWorkspaceError('Network error while loading messages');
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [activeChannelId, group.id, messagesByChannel]);

  useEffect(() => {
    if (!activeChannelId) {
      return;
    }

    let cancelled = false;
    const channelId = activeChannelId;

    async function refreshMessages() {
      try {
        const response = await fetch(
          `/api/groups/${group.id}/channels/${channelId}/messages`,
          {
            cache: 'no-store',
          }
        );
        const data = (await response.json().catch(() => null)) as
          GroupMessage[] | { error: string } | null;

        if (cancelled || !response.ok || !Array.isArray(data)) {
          return;
        }

        setMessagesByChannel((current) => ({
          ...current,
          [channelId]: data,
        }));
      } catch {
        // Keep polling silent so chat doesn't flash an error while waiting.
      }
    }

    const intervalId = window.setInterval(refreshMessages, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeChannelId, group.id]);

  async function createChannel() {
    setCreatingChannel(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: channelName.trim(),
          description: channelDescription.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        GroupWorkspaceProps['channels'][number] | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to create the channel'
        );
        return;
      }

      const createdChannel: GroupWorkspaceProps['channels'][number] = data;
      setChannels((current) =>
        [...current, createdChannel].sort(
          (left, right) => left.position - right.position
        )
      );
      setChannelName('');
      setChannelDescription('');
      setSelectedChannelId(createdChannel.id);
      syncQuery(selectedTab, createdChannel.id);
    } catch {
      setWorkspaceError('Network error while creating the channel');
    } finally {
      setCreatingChannel(false);
    }
  }

  async function sendMessage() {
    if (!activeChannelId) return;

    const channelId = activeChannelId;
    setSendingMessage(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(
        `/api/groups/${group.id}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: messageDraft.trim() }),
        }
      );
      const data = (await response.json().catch(() => null)) as
        GroupMessage | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to send the message'
        );
        return;
      }

      const createdMessage: GroupMessage = data;
      setMessagesByChannel((current) => ({
        ...current,
        [channelId]: [...(current[channelId] || []), createdMessage],
      }));
      setMessageDraft('');
    } catch {
      setWorkspaceError('Network error while sending the message');
    } finally {
      setSendingMessage(false);
    }
  }

  async function createTask() {
    setCreatingTask(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          dueAt: taskForm.dueAt || null,
          status: taskForm.status,
          channelId: taskForm.channelId || null,
          assigneeUserIds: taskForm.assigneeUserIds,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        GroupTask | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to create the task'
        );
        return;
      }

      const createdTask: GroupTask = data;
      setTasks((current) =>
        [...current, createdTask].sort((left, right) => {
          const leftTime = left.dueAt
            ? new Date(left.dueAt).getTime()
            : Infinity;
          const rightTime = right.dueAt
            ? new Date(right.dueAt).getTime()
            : Infinity;
          return leftTime - rightTime;
        })
      );
      setTaskForm({
        title: '',
        description: '',
        dueAt: '',
        status: 'TODO',
        channelId: '',
        assigneeUserIds: [],
      });
    } catch {
      setWorkspaceError('Network error while creating the task');
    } finally {
      setCreatingTask(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json().catch(() => null)) as
        GroupTask | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to update the task'
        );
        return;
      }

      const updatedTask: GroupTask = data;
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updatedTask : task))
      );
    } catch {
      setWorkspaceError('Network error while updating the task');
    }
  }

  async function deleteTask(taskId: string) {
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setWorkspaceError(data?.error ?? 'Unable to delete the task');
        return;
      }

      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch {
      setWorkspaceError('Network error while deleting the task');
    }
  }

  async function updateMember(
    memberId: string,
    updates: { role?: string; customRoleId?: string | null }
  ) {
    setWorkspaceError(null);

    try {
      const response = await fetch(
        `/api/groups/${group.id}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      const data = (await response.json().catch(() => null)) as
        GroupMember | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to update the member'
        );
        return;
      }

      const updatedMember: GroupMember = data;
      setMembers((current) =>
        current.map((member) =>
          member.id === memberId ? updatedMember : member
        )
      );
    } catch {
      setWorkspaceError('Network error while updating the member');
    }
  }

  async function createCustomRole() {
    setCreatingCustomRole(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customRoleForm.name.trim(),
          color: customRoleForm.color.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        GroupWorkspaceProps['customRoles'][number] | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to create the custom role'
        );
        return;
      }

      setCustomRoles((current) => [...current, data]);
      setCustomRoleForm({
        name: '',
        color: '#2563eb',
      });
    } catch {
      setWorkspaceError('Network error while creating the custom role');
    } finally {
      setCreatingCustomRole(false);
    }
  }

  async function deleteCustomRole(roleId: string) {
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/roles/${roleId}`, {
        method: 'DELETE',
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setWorkspaceError(data?.error ?? 'Unable to delete the custom role');
        return;
      }

      setCustomRoles((current) => current.filter((role) => role.id !== roleId));
      setMembers((current) =>
        current.map((member) =>
          member.customRole?.id === roleId
            ? { ...member, customRole: null }
            : member
        )
      );
    } catch {
      setWorkspaceError('Network error while deleting the custom role');
    }
  }

  async function removeMember(memberId: string) {
    setWorkspaceError(null);

    try {
      const response = await fetch(
        `/api/groups/${group.id}/members/${memberId}`,
        {
          method: 'DELETE',
        }
      );
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setWorkspaceError(data?.error ?? 'Unable to remove the member');
        return;
      }

      setMembers((current) =>
        current.filter((member) => member.id !== memberId)
      );
    } catch {
      setWorkspaceError('Network error while removing the member');
    }
  }

  async function createInvite() {
    setCreatingInvite(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: inviteForm.expiresAt || null,
          maxUses: inviteForm.maxUses ? Number(inviteForm.maxUses) : null,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        (GroupInvite & { joinPath: string }) | { error: string } | null;

      if (!response.ok || !data || 'error' in data) {
        setWorkspaceError(
          data && 'error' in data && data.error
            ? data.error
            : 'Unable to create the invite'
        );
        return;
      }

      const createdInvite: GroupInvite & { joinPath: string } = data;
      setInvites((current) => [createdInvite, ...current]);
      setInviteForm({ expiresAt: '', maxUses: '' });
      setLatestInviteLink(
        typeof window === 'undefined'
          ? createdInvite.joinPath
          : `${window.location.origin}${createdInvite.joinPath}`
      );
    } catch {
      setWorkspaceError('Network error while creating the invite');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    setWorkspaceError(null);

    try {
      const response = await fetch(
        `/api/groups/${group.id}/invites/${inviteId}`,
        {
          method: 'DELETE',
        }
      );
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setWorkspaceError(data?.error ?? 'Unable to revoke the invite');
        return;
      }

      setInvites((current) =>
        current.map((invite) =>
          invite.id === inviteId
            ? {
                ...invite,
                status: 'REVOKED',
                normalizedStatus: 'REVOKED',
              }
            : invite
        )
      );
    } catch {
      setWorkspaceError('Network error while revoking the invite');
    }
  }

  async function deleteGroup() {
    if (!isOwner || deletingGroup) return;

    const confirmed = window.confirm(
      `Delete "${group.name}"? This removes its channels, messages, tasks, invites, and memberships.`
    );
    if (!confirmed) return;

    setDeletingGroup(true);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setWorkspaceError(data?.error ?? 'Unable to delete the group');
        return;
      }

      router.push('/dashboard/groups');
      router.refresh();
    } catch {
      setWorkspaceError('Network error while deleting the group');
    } finally {
      setDeletingGroup(false);
    }
  }

  return (
    <div className="space-y-6">
      <DashboardPanel>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Group workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {group.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              {group.description ||
                'Private collaboration space for channels, shared tasks, and a group-only calendar.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm sm:min-w-[320px]">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-slate-400">Channels</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {channels.length}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-slate-400">Members</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {members.length}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-slate-400">Tasks</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {tasks.length}
              </p>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="mt-5 flex justify-start">
            <button
              type="button"
              onClick={deleteGroup}
              disabled={deletingGroup}
              className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingGroup ? 'Deleting…' : 'Delete group'}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setSelectedTab(tab.value);
                syncQuery(tab.value, activeChannelId);
              }}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition',
                selectedTab === tab.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {workspaceError && (
          <p className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {workspaceError}
          </p>
        )}
      </DashboardPanel>

      {selectedTab === 'chat' && (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <DashboardPanel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Channels</h2>
              <Link
                href="/dashboard/groups"
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                All groups
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => {
                    setSelectedChannelId(channel.id);
                    syncQuery(selectedTab, channel.id);
                  }}
                  className={[
                    'w-full rounded-2xl border px-4 py-3 text-left transition',
                    activeChannelId === channel.id
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-200',
                  ].join(' ')}
                >
                  <p className="font-medium text-slate-900"># {channel.name}</p>
                  {channel.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {channel.description}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {isAdmin && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Add channel
                </h3>
                <div className="mt-3 space-y-3">
                  <input
                    value={channelName}
                    onChange={(event) => setChannelName(event.target.value)}
                    placeholder="Channel name"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                  />
                  <textarea
                    value={channelDescription}
                    onChange={(event) =>
                      setChannelDescription(event.target.value)
                    }
                    placeholder="What should people discuss here?"
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                  />
                  <button
                    type="button"
                    onClick={createChannel}
                    disabled={
                      creatingChannel || channelName.trim().length === 0
                    }
                    className="btn-secondary"
                  >
                    {creatingChannel ? 'Creating…' : 'Create channel'}
                  </button>
                </div>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel className="flex min-h-[560px] flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {activeChannelId
                    ? `# ${channels.find((channel) => channel.id === activeChannelId)?.name || 'channel'}`
                    : 'No channels yet'}
                </h2>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto py-5">
              {loadingMessages ? (
                <p className="text-sm text-slate-500">Loading messages…</p>
              ) : activeMessages.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No messages here yet. Start the conversation.
                </p>
              ) : (
                activeMessages.map((message) => {
                  const authorMember = membersByUserId[message.author.id];
                  const isCurrentUser = message.author.id === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <Avatar user={message.author} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={[
                              'font-medium',
                              isCurrentUser
                                ? 'text-brand-700'
                                : 'text-slate-900',
                            ].join(' ')}
                          >
                            {displayName(message.author)}
                          </p>
                          {authorMember && (
                            <span
                              className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                              style={roleBadgeStyle(authorMember)}
                            >
                              {displayRole(authorMember)}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            <DateLabel
                              value={message.createdAt}
                              mode="dateTime"
                              mounted={mounted}
                            />
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Send a message to this channel"
                  rows={3}
                  className="min-h-[96px] flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={
                    sendingMessage ||
                    !activeChannelId ||
                    messageDraft.trim().length === 0
                  }
                  className="btn-primary self-end"
                >
                  {sendingMessage ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </DashboardPanel>
        </div>
      )}

      {selectedTab === 'tasks' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <DashboardPanel>
            <h2 className="text-lg font-semibold text-slate-900">
              Create a group task
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Assign work to one or more members and it will sync into each
              assignee&apos;s in-app calendar automatically.
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Task title"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
              />
              <textarea
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Description"
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  value={taskForm.dueAt}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      dueAt: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                />
                <select
                  value={taskForm.channelId}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      channelId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                >
                  <option value="">No channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={taskForm.status}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                >
                  <option value="TODO">To do</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="DONE">Done</option>
                </select>
                <select
                  multiple
                  value={taskForm.assigneeUserIds}
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      assigneeUserIds: Array.from(
                        event.target.selectedOptions,
                        (option) => option.value
                      ),
                    }))
                  }
                  className="h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                >
                  {members.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {displayName(member.user)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400">
                Hold Command on Mac or Ctrl on Windows to select multiple
                assignees.
              </p>
              <button
                type="button"
                onClick={createTask}
                disabled={creatingTask || taskForm.title.trim().length === 0}
                className="btn-primary"
              >
                {creatingTask ? 'Creating…' : 'Create task'}
              </button>
            </div>
          </DashboardPanel>

          <div className="space-y-4">
            {tasks.length === 0 ? (
              <DashboardPanel>
                <p className="text-sm text-slate-500">
                  No group tasks yet. Create the first one on the left.
                </p>
              </DashboardPanel>
            ) : (
              tasks.map((task) => (
                <DashboardPanel key={task.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {task.title}
                        </h2>
                        {task.channel && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            # {task.channel.name}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="mt-2 text-sm text-slate-500">
                          {task.description}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-slate-500">
                        Due{' '}
                        <DateLabel
                          value={task.dueAt}
                          mode="dateTime"
                          mounted={mounted}
                        />{' '}
                        · Created by {displayName(task.createdBy)}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Assigned to{' '}
                        {task.assignees.length === 0
                          ? 'no one yet'
                          : task.assignees
                              .map((assignee) => displayName(assignee.user))
                              .join(', ')}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={task.status}
                        onChange={(event) =>
                          updateTaskStatus(task.id, event.target.value)
                        }
                        className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400"
                      >
                        <option value="TODO">To do</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="DONE">Done</option>
                      </select>
                      {(isAdmin || task.createdBy.id === currentUserId) && (
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </DashboardPanel>
              ))
            )}
          </div>
        </div>
      )}

      {selectedTab === 'calendar' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
          <DashboardPanel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Group calendar
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Only group tasks appear here. Personal assignments and quests
                  stay out of this calendar.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                        1
                      )
                    )
                  }
                  className="btn-secondary text-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date())}
                  className="btn-secondary text-sm"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        1
                      )
                    )
                  }
                  className="btn-secondary text-sm"
                >
                  Next
                </button>
              </div>
            </div>

            <h3 className="mt-5 text-xl font-semibold text-slate-900">
              <span suppressHydrationWarning>
                {mounted
                  ? monthTitleLocal(calendarMonth)
                  : monthTitleUTC(calendarMonth)}
              </span>
            </h3>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (label) => (
                  <div key={label} className="py-2">
                    {label}
                  </div>
                )
              )}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dayKey = getDayKey(day);
                const dayTasks = tasksByDay[dayKey] || [];

                return (
                  <div
                    key={dayKey}
                    className={[
                      'min-h-28 rounded-2xl border p-3',
                      day.getMonth() === calendarMonth.getMonth()
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-100 bg-slate-50 opacity-60',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {day.getDate()}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[11px] text-slate-400">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="rounded-xl bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700"
                        >
                          <DateLabel
                            value={task.dueAt}
                            mode="time"
                            mounted={mounted}
                          />{' '}
                          · {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="text-[11px] text-slate-400">
                          +{dayTasks.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardPanel>

          <DashboardPanel>
            <h2 className="text-lg font-semibold text-slate-900">
              Upcoming group tasks
            </h2>
            <div className="mt-4 space-y-3">
              {dueTasks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No dated group tasks yet.
                </p>
              ) : (
                dueTasks.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {task.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      <DateLabel
                        value={task.dueAt}
                        mode="dateTime"
                        mounted={mounted}
                      />
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {task.assignees.length === 0
                        ? 'No assignees'
                        : task.assignees
                            .map((assignee) => displayName(assignee.user))
                            .join(', ')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </DashboardPanel>
        </div>
      )}

      {selectedTab === 'members' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">
            {members.map((member) => (
              <DashboardPanel key={member.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-3">
                    <Avatar user={member.user} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900">
                          {displayName(member.user)}
                        </h2>
                        <span
                          className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                          style={roleBadgeStyle(member)}
                        >
                          {displayRole(member)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Joined{' '}
                        <DateLabel
                          value={member.joinedAt}
                          mode="shortDate"
                          mounted={mounted}
                        />
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {isAdmin && member.role !== 'OWNER' ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(event) =>
                            updateMember(member.id, {
                              role: event.target.value,
                            })
                          }
                          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <select
                          value={member.customRole?.id || ''}
                          onChange={(event) =>
                            updateMember(member.id, {
                              customRoleId: event.target.value || null,
                            })
                          }
                          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-400"
                        >
                          <option value="">No custom role</option>
                          {customRoles.map((customRole) => (
                            <option key={customRole.id} value={customRole.id}>
                              {customRole.name}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {member.role}
                      </span>
                    )}

                    {isAdmin && member.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </DashboardPanel>
            ))}
          </div>

          <div className="space-y-4">
            <DashboardPanel>
              <h2 className="text-lg font-semibold text-slate-900">
                Custom roles
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Create display roles for members. Admin and owner permissions
                still come from the permission dropdown.
              </p>
              {isAdmin ? (
                <div className="mt-4 space-y-3">
                  <input
                    value={customRoleForm.name}
                    onChange={(event) =>
                      setCustomRoleForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Role name"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={customRoleForm.color}
                      onChange={(event) =>
                        setCustomRoleForm((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      className="h-12 w-16 rounded-2xl border border-slate-200 bg-white p-1"
                    />
                    <input
                      value={customRoleForm.color}
                      onChange={(event) =>
                        setCustomRoleForm((current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      placeholder="#2563eb"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createCustomRole}
                    disabled={
                      creatingCustomRole ||
                      customRoleForm.name.trim().length === 0
                    }
                    className="btn-primary"
                  >
                    {creatingCustomRole ? 'Creating…' : 'Create custom role'}
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Only admins can create and assign custom roles.
                </p>
              )}
            </DashboardPanel>

            <DashboardPanel>
              <h2 className="text-lg font-semibold text-slate-900">
                Existing roles
              </h2>
              <div className="mt-4 space-y-3">
                {customRoles.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No custom roles created yet.
                  </p>
                ) : (
                  customRoles.map((customRole) => (
                    <div
                      key={customRole.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: customRole.color }}
                        />
                        <span className="font-medium text-slate-900">
                          {customRole.name}
                        </span>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => deleteCustomRole(customRole.id)}
                          className="rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </DashboardPanel>
          </div>
        </div>
      )}

      {selectedTab === 'invites' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <DashboardPanel>
            <h2 className="text-lg font-semibold text-slate-900">
              Invite members
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Generate a private join link. Only people with the link can enter
              the group.
            </p>

            {!isAdmin ? (
              <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Only admins can create or revoke invite links.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="datetime-local"
                  value={inviteForm.expiresAt}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      expiresAt: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                />
                <input
                  type="number"
                  min="1"
                  value={inviteForm.maxUses}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      maxUses: event.target.value,
                    }))
                  }
                  placeholder="Optional max uses"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={createInvite}
                  disabled={creatingInvite}
                  className="btn-primary"
                >
                  {creatingInvite ? 'Creating…' : 'Create invite link'}
                </button>
                {latestInviteLink && (
                  <div className="rounded-2xl bg-brand-50 px-4 py-4">
                    <p className="text-sm font-medium text-brand-700">
                      Latest invite link
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-600">
                      {latestInviteLink}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(latestInviteLink)
                      }
                      className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </div>
            )}
          </DashboardPanel>

          <div className="space-y-4">
            {invites.length === 0 ? (
              <DashboardPanel>
                <p className="text-sm text-slate-500">
                  No invite links created yet.
                </p>
              </DashboardPanel>
            ) : (
              invites.map((invite) => (
                <DashboardPanel key={invite.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                        {invite.normalizedStatus}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Created{' '}
                        <DateLabel
                          value={invite.createdAt}
                          mode="dateTime"
                          mounted={mounted}
                        />
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Uses {invite.useCount}
                        {invite.maxUses ? ` / ${invite.maxUses}` : ''}
                        {invite.expiresAt ? ' · Expires ' : ''}
                        {invite.expiresAt && (
                          <DateLabel
                            value={invite.expiresAt}
                            mode="dateTime"
                            mounted={mounted}
                          />
                        )}
                      </p>
                    </div>
                    {isAdmin && invite.normalizedStatus === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => revokeInvite(invite.id)}
                        className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </DashboardPanel>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
