'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The "you are signed in as someone else" bar.
 *
 * Deliberately loud and fixed to the top of every dashboard page. The whole
 * risk of impersonation is an admin forgetting they are in it and taking an
 * action they believe is their own, so this cannot be dismissed — only exited.
 */
export function ImpersonationBanner({ email }: { email: string }) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    setStopping(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/impersonate/stop', {
        method: 'POST',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? 'Could not stop impersonating');
        setStopping(false);
        return;
      }
      // A full reload, not router.refresh(): the session cookie just changed
      // underneath the app and every cached server payload belongs to the
      // account we are leaving.
      window.location.href = '/dashboard/admin/users';
    } catch {
      setError('Could not stop impersonating');
      setStopping(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-white"
      style={{ background: 'var(--danger, #dc2626)' }}
    >
      <span>
        Viewing as <strong>{email}</strong> — actions you take are recorded
        against this account.
        {error && <span className="ml-2 opacity-90">{error}</span>}
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 font-semibold transition hover:bg-white/30 disabled:opacity-60"
      >
        {stopping ? 'Returning…' : 'Stop impersonating'}
      </button>
    </div>
  );
}
