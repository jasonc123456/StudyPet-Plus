'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Props = {
  userId: string;
  email: string;
  isAdmin: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  mfaEnabled: boolean;
  activeSessions: number;
  aiLimit: number;
  hasOverride: boolean;
  defaultLimit: number;
  /** True when this row is the signed-in admin — self-directed actions hide. */
  isSelf: boolean;
};

type Result = { tone: 'ok' | 'error'; message: string } | null;

/**
 * The mutating half of the user detail page.
 *
 * Every destructive control is behind a second step in the UI *and* a check on
 * the server (see admin-validators + guardTarget) — the client-side confirm is
 * for the operator's benefit, not a security boundary, so neither one is
 * treated as sufficient alone.
 */
export function AdminUserActions({
  userId,
  email,
  isAdmin,
  isSuspended,
  suspendedReason,
  mfaEnabled,
  activeSessions,
  aiLimit,
  hasOverride,
  defaultLimit,
  isSelf,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  const [reason, setReason] = useState(suspendedReason ?? '');
  const [limitInput, setLimitInput] = useState(
    hasOverride ? String(aiLimit) : ''
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');

  async function call(
    label: string,
    path: string,
    init: RequestInit,
    onDone?: () => void
  ) {
    setBusy(label);
    setResult(null);
    try {
      const response = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResult({ tone: 'error', message: body.error ?? 'Request failed' });
        return false;
      }

      setResult({ tone: 'ok', message: `${label} — done.` });
      onDone?.();
      startTransition(() => router.refresh());
      return true;
    } catch {
      setResult({ tone: 'error', message: 'Network error' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const patch = (label: string, payload: Record<string, unknown>) =>
    call(label, `/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

  const disabled = busy !== null || pending;

  async function impersonate() {
    const ok = await call('Impersonation started', '/api/admin/impersonate', {
      method: 'POST',
      body: JSON.stringify({ userId, acknowledge: true }),
    });
    // The session cookie has been swapped, so leave the admin console entirely
    // rather than re-rendering a page this browser no longer has rights to.
    if (ok) window.location.href = '/dashboard';
  }

  async function saveLimit() {
    const trimmed = limitInput.trim();
    if (trimmed === '') {
      await patch('AI limit reset to default', { aiDailyLimitOverride: null });
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setResult({
        tone: 'error',
        message: 'Enter a whole number of at least 1',
      });
      return;
    }
    await patch('AI limit updated', { aiDailyLimitOverride: parsed });
  }

  async function remove() {
    const ok = await call('Account deleted', `/api/admin/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmEmail: deleteEmail }),
    });
    if (ok) router.push('/dashboard/admin/users');
  }

  return (
    <div className="flex flex-col gap-4">
      {result && (
        <p
          role="status"
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            color: result.tone === 'ok' ? 'var(--success)' : 'var(--danger)',
            background: `color-mix(in srgb, ${
              result.tone === 'ok' ? 'var(--success)' : 'var(--danger)'
            } 12%, transparent)`,
          }}
        >
          {result.message}
        </p>
      )}

      <section className="card flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Access</h3>

        {isSelf ? (
          <p className="theme-muted text-sm">
            This is your own account. Role, suspension, impersonation and
            deletion are disabled here to prevent locking yourself out.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                patch(isAdmin ? 'Admin role revoked' : 'Admin role granted', {
                  role: isAdmin ? 'USER' : 'ADMIN',
                })
              }
              className="btn-secondary"
            >
              {isAdmin ? 'Revoke admin' : 'Make admin'}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                patch(
                  isSuspended ? 'Account reinstated' : 'Account suspended',
                  {
                    suspended: !isSuspended,
                    suspendedReason: isSuspended ? null : reason || null,
                  }
                )
              }
              className="btn-secondary"
            >
              {isSuspended ? 'Reinstate account' : 'Suspend account'}
            </button>

            <button
              type="button"
              disabled={disabled || isSuspended || isAdmin}
              onClick={impersonate}
              className="btn-secondary"
              title={
                isAdmin
                  ? 'Admin accounts cannot be impersonated'
                  : isSuspended
                    ? 'Reinstate the account first'
                    : 'Sign in as this user for 30 minutes'
              }
            >
              Sign in as user
            </button>
          </div>
        )}

        {!isSelf && !isSuspended && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="theme-muted">Suspension reason (optional)</span>
            <input
              type="text"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Shown only in the audit log"
              className="theme-input w-full rounded-lg px-3 py-2 text-sm"
            />
          </label>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Sessions and sign-in</h3>
        <p className="theme-muted text-sm">
          {activeSessions === 0
            ? 'No live sessions.'
            : `${activeSessions} live session${activeSessions === 1 ? '' : 's'}.`}{' '}
          {mfaEnabled
            ? 'A second factor is enrolled.'
            : 'No second factor enrolled.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || activeSessions === 0}
            onClick={() =>
              call('Sessions revoked', `/api/admin/users/${userId}/sessions`, {
                method: 'DELETE',
              })
            }
            className="btn-secondary"
          >
            Revoke all sessions
          </button>

          <button
            type="button"
            disabled={disabled || !mfaEnabled}
            onClick={() =>
              call('Second factor reset', `/api/admin/users/${userId}/mfa`, {
                method: 'DELETE',
              })
            }
            className="btn-secondary"
            title="Account recovery — clears TOTP and every passkey"
          >
            Reset second factor
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">AI generation limit</h3>
        <p className="theme-muted text-sm">
          Currently {aiLimit} per day
          {hasOverride ? ' (override)' : ` (deployment default)`}. Leave the box
          empty and save to return this account to the default of {defaultLimit}
          .
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="theme-muted">Daily limit</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={limitInput}
              onChange={(event) => setLimitInput(event.target.value)}
              placeholder={String(defaultLimit)}
              className="theme-input w-32 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={saveLimit}
            className="btn-secondary"
          >
            Save limit
          </button>
        </div>
      </section>

      {!isSelf && (
        <section
          className="card flex flex-col gap-3 p-4"
          style={{
            borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
          }}
        >
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--danger)' }}
          >
            Delete account
          </h3>
          <p className="theme-muted text-sm">
            Permanently removes this user and everything they own — notes,
            quizzes, flashcards, courses, grades, uploads, and their membership
            of every study group. This cannot be undone. The audit log keeps a
            record that it happened.
          </p>

          {confirmDelete ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="theme-muted">
                  Type <strong>{email}</strong> to confirm
                </span>
                <input
                  type="text"
                  value={deleteEmail}
                  onChange={(event) => setDeleteEmail(event.target.value)}
                  className="theme-input w-full rounded-lg px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    disabled ||
                    deleteEmail.trim().toLowerCase() !== email.toLowerCase()
                  }
                  onClick={remove}
                  className="btn-primary"
                  style={{ background: 'var(--danger)' }}
                >
                  Delete permanently
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteEmail('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmDelete(true)}
              className="btn-secondary self-start"
              style={{ color: 'var(--danger)' }}
            >
              Delete this account…
            </button>
          )}
        </section>
      )}
    </div>
  );
}
