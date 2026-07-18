'use client';

// Second-factor challenge UI (US-4.S1). Offers whichever factors the user has
// enrolled: a TOTP code field and/or a "Use a passkey" button. On success it
// hard-navigates to the callback so the server re-runs the dashboard gate with
// the now-verified session.

import { startAuthentication } from '@simplewebauthn/browser';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

type MfaGateProps = {
  hasTotp: boolean;
  hasPasskey: boolean;
  callbackUrl: string;
};

export function MfaGate({ hasTotp, hasPasskey, callbackUrl }: MfaGateProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function done() {
    // Full navigation so the server component gate re-evaluates the session.
    window.location.assign(callbackUrl);
  }

  async function submitTotp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mfa/challenge/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Verification failed');
      done();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setBusy(false);
    }
  }

  async function usePasskey() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch('/api/mfa/challenge/options', {
        method: 'POST',
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(options.error ?? 'Could not start passkey sign-in');
      }

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/mfa/challenge/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      });
      const data = (await verifyRes.json()) as { error?: string };
      if (!verifyRes.ok) throw new Error(data.error ?? 'Passkey failed');
      done();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Passkey verification failed'
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 via-white to-mint-400/40 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur">
        <span className="mx-auto block text-5xl">🔐</span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
          Verify it&rsquo;s you
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account has an extra security step. Confirm a second factor to
          continue.
        </p>

        {hasTotp ? (
          <form onSubmit={submitTotp} className="mt-6 flex flex-col gap-3">
            <label
              htmlFor="totp-code"
              className="text-left text-sm font-medium text-slate-700"
            >
              Authenticator code
            </label>
            <input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-primary py-2.5 disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
        ) : null}

        {hasTotp && hasPasskey ? (
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        ) : null}

        {hasPasskey ? (
          <button
            type="button"
            onClick={usePasskey}
            disabled={busy}
            className="btn-secondary w-full py-2.5 disabled:opacity-60"
          >
            🔑 Use a passkey
          </button>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-6 text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
