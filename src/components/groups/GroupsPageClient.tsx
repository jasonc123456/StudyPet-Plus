'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useState } from 'react';

import { DashboardPanel } from '@/components/dashboard/DashboardPanel';

type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  role: string;
  memberCount: number;
  channelCount: number;
  taskCount: number;
};

type GroupsPageClientProps = {
  groups: GroupSummary[];
  groupsReady: boolean;
};

export function GroupsPageClient({
  groups,
  groupsReady,
}: GroupsPageClientProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function createGroup() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.id) {
        setError(data?.error ?? 'Unable to create the group');
        return;
      }

      setName('');
      setDescription('');
      startTransition(() => {
        router.push(`/dashboard/groups/${data.id}`);
        router.refresh();
      });
    } catch {
      setError('Network error while creating the group');
    } finally {
      setSubmitting(false);
    }
  }

  async function joinGroup() {
    setJoining(true);
    setJoinError(null);

    try {
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken.trim() }),
      });

      const data = (await response.json().catch(() => null)) as {
        group?: { id: string };
        error?: string;
      } | null;

      if (!response.ok || !data?.group?.id) {
        setJoinError(data?.error ?? 'Unable to join the group');
        return;
      }

      const groupId = data.group.id;
      setInviteToken('');
      startTransition(() => {
        router.push(`/dashboard/groups/${groupId}`);
        router.refresh();
      });
    } catch {
      setJoinError('Network error while joining the group');
    } finally {
      setJoining(false);
    }
  }

  if (!groupsReady) {
    return (
      <DashboardPanel>
        <h2 className="text-lg font-semibold text-slate-900">
          Group collaboration needs one more setup step
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Run{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">
            npx prisma migrate dev
          </code>{' '}
          locally so the new group tables exist, then refresh this page.
        </p>
      </DashboardPanel>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="space-y-4">
        {groups.length === 0 ? (
          <DashboardPanel className="text-center">
            <h2 className="text-lg font-semibold text-slate-900">
              No groups yet
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Create your first study group or join one with an invite token.
            </p>
          </DashboardPanel>
        ) : (
          groups.map((group) => (
            <Link
              key={group.id}
              href={`/dashboard/groups/${group.id}`}
              className="card block p-5 transition hover:border-brand-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {group.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {group.description ||
                      'Shared study channels, tasks, and calendar'}
                  </p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {group.role}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-slate-400">Members</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {group.memberCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-slate-400">Channels</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {group.channelCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-slate-400">Tasks</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {group.taskCount}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="space-y-6">
        <DashboardPanel>
          <h2 className="text-lg font-semibold text-slate-900">
            Create a group
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Start a private study space with channels, tasks, and a shared
            calendar.
          </p>
          <div className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Group name"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this group for?"
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400"
            />
            {error && (
              <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={createGroup}
              disabled={submitting || name.trim().length === 0}
              className="btn-primary"
            >
              {submitting ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </DashboardPanel>

        <DashboardPanel>
          <h2 className="text-lg font-semibold text-slate-900">
            Join with invite link or token
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Paste the private invite link or just the token and we&apos;ll add
            you to the group.
          </p>
          <div className="mt-4 space-y-3">
            <input
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              placeholder="Paste invite link or token"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400"
            />
            {joinError && (
              <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {joinError}
              </p>
            )}
            <button
              type="button"
              onClick={joinGroup}
              disabled={joining || inviteToken.trim().length === 0}
              className="btn-secondary"
            >
              {joining ? 'Joining…' : 'Join group'}
            </button>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
