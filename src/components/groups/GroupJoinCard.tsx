'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type GroupJoinCardProps = {
  token: string;
  signedIn: boolean;
};

export function GroupJoinCard({ token, signedIn }: GroupJoinCardProps) {
  const router = useRouter();
  const [inviteToken, setInviteToken] = useState(token);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function joinGroup() {
    setJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken.trim() }),
      });

      const data = (await response.json().catch(() => null)) as {
        group?: { id: string; name: string };
        error?: string;
      } | null;

      if (!response.ok || !data?.group?.id) {
        setError(data?.error ?? 'Unable to join the group');
        return;
      }

      router.push(`/dashboard/groups/${data.group.id}`);
      router.refresh();
    } catch {
      setError('Network error while joining the group');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center">
      <div className="card w-full p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
          Group invite
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Join a study group
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Invite links are private. Only people with a valid token can join.
        </p>

        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Invite token
            </span>
            <input
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400"
            />
          </label>

          {error && (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!signedIn ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
              Sign in first, then come back to this same invite link to join the
              group without affecting the magic-link setup.
              <div className="mt-3">
                <Link href="/login" className="btn-primary inline-flex">
                  Go to login
                </Link>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={joinGroup}
              disabled={joining || inviteToken.trim().length === 0}
              className="btn-primary"
            >
              {joining ? 'Joining…' : 'Join group'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
