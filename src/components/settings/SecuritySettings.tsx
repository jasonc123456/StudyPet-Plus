'use client';

// Security tab of the settings modal (US-4.S1). Manages the two optional second
// factors: authenticator-app TOTP and WebAuthn passkeys. All state is loaded
// from /api/mfa/status so it always reflects the server.

import { startRegistration } from '@simplewebauthn/browser';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

type Passkey = {
  id: string;
  deviceName: string | null;
  createdAt: string;
};

type MfaStatus = {
  totpActivated: boolean;
  passkeys: Passkey[];
};

type TotpSetup = {
  otpauthUrl: string;
  secret: string;
  qrDataUrl: string;
};

export function SecuritySettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // TOTP enrollment flow state.
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mfa/status');
      const data = (await res.json()) as MfaStatus & { error?: string };
      if (!res.ok)
        throw new Error(data.error ?? 'Could not load security info');
      setStatus({ totpActivated: data.totpActivated, passkeys: data.passkeys });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function startTotp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mfa/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      const data = (await res.json()) as TotpSetup & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not start setup');
      setSetup(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start setup');
    } finally {
      setBusy(false);
    }
  }

  async function activateTotp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mfa/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not confirm code');
      setSetup(null);
      setCode('');
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm code');
    } finally {
      setBusy(false);
    }
  }

  async function disableTotp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mfa/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not turn off TOTP');
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off TOTP');
    } finally {
      setBusy(false);
    }
  }

  async function addPasskey() {
    setBusy(true);
    setError(null);
    try {
      const deviceName =
        window.prompt('Name this passkey (e.g. "MacBook Touch ID")') ??
        undefined;

      const optionsRes = await fetch('/api/mfa/passkey/register/options', {
        method: 'POST',
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        throw new Error(options.error ?? 'Could not start passkey setup');
      }

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/mfa/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attestation, deviceName }),
      });
      const data = (await verifyRes.json()) as { error?: string };
      if (!verifyRes.ok) throw new Error(data.error ?? 'Could not add passkey');
      await loadStatus();
    } catch (err) {
      // The browser throws if the user cancels the prompt — treat as a no-op.
      if (
        err instanceof Error &&
        /timed out|not allowed|abort/i.test(err.message)
      ) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not add passkey');
      }
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/mfa/passkey/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not remove passkey');
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove passkey');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h3 className="text-3xl font-black tracking-tight">Security</h3>
      <p className="theme-muted mt-3 text-sm">
        Add a second factor on top of your email sign-in. Both are optional.
      </p>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="theme-muted mt-8 text-sm">Loading…</p>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          {/* --- TOTP --- */}
          <section className="rounded-2xl border border-[var(--card-border)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold">Authenticator app (TOTP)</h4>
                <p className="theme-muted mt-1 text-sm">
                  Use Google Authenticator, 1Password, Authy, etc.
                </p>
              </div>
              <StatusPill on={status?.totpActivated ?? false} />
            </div>

            {status?.totpActivated ? (
              <button
                type="button"
                onClick={disableTotp}
                disabled={busy}
                className="btn-secondary mt-4 px-4 py-2 text-sm disabled:opacity-60"
              >
                Turn off
              </button>
            ) : setup ? (
              <form
                onSubmit={activateTotp}
                className="mt-4 flex flex-col gap-4"
              >
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <Image
                    src={setup.qrDataUrl}
                    alt="TOTP QR code"
                    width={160}
                    height={160}
                    unoptimized
                    className="rounded-xl border border-[var(--card-border)] bg-white p-2"
                  />
                  <div className="text-sm">
                    <p className="theme-muted">
                      Scan the QR, or enter this key manually:
                    </p>
                    <code className="mt-1 block break-all rounded-lg bg-[var(--btn-secondary-hover)] px-2 py-1 text-xs">
                      {setup.secret}
                    </code>
                    <label
                      htmlFor="totp-activate-code"
                      className="mt-3 block font-medium"
                    >
                      Enter the 6-digit code
                    </label>
                    <input
                      id="totp-activate-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="mt-1 w-40 rounded-lg border border-[var(--card-border)] bg-white px-3 py-2 text-center tracking-[0.2em] text-slate-900 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                  >
                    Confirm &amp; enable
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSetup(null);
                      setCode('');
                    }}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={startTotp}
                disabled={busy}
                className="btn-primary mt-4 px-4 py-2 text-sm disabled:opacity-60"
              >
                Set up authenticator app
              </button>
            )}
          </section>

          {/* --- Passkeys --- */}
          <section className="rounded-2xl border border-[var(--card-border)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-bold">Passkeys</h4>
                <p className="theme-muted mt-1 text-sm">
                  Face ID, Touch ID, Windows Hello, or a security key.
                </p>
              </div>
              <StatusPill on={(status?.passkeys.length ?? 0) > 0} />
            </div>

            {status && status.passkeys.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {status.passkeys.map((passkey) => (
                  <li
                    key={passkey.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-4 py-2.5"
                  >
                    <span className="text-sm font-medium">
                      🔑 {passkey.deviceName ?? 'Passkey'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePasskey(passkey.id)}
                      disabled={busy}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <button
              type="button"
              onClick={addPasskey}
              disabled={busy}
              className="btn-secondary mt-4 px-4 py-2 text-sm disabled:opacity-60"
            >
              Add a passkey
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusPill({ on }: { on: boolean }) {
  return (
    <span
      className={[
        'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
        on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500',
      ].join(' ')}
    >
      {on ? 'On' : 'Off'}
    </span>
  );
}
