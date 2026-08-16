'use client';

// The "Try the demo" button.
//
// This used to be a plain <a href="/api/demo-login">, which meant any page on
// the internet could hand a visitor a link (or a redirect, or an <img>) that
// silently swapped their session for the shared demo account and reseeded the
// demo data on the way through. Signing in is a state change, so it is a POST
// now, protected by a double-submit CSRF token.
//
// The token pairing is what makes it safe: a cross-site page can neither read
// nor set a cookie on this origin, so it cannot produce a request whose cookie
// and body agree. Generating it here in the browser (rather than seeding it
// server-side) keeps the landing page a static server component.

import { useState } from 'react';

const CSRF_COOKIE = 'demo-csrf';

function newCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function DemoLoginButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setBusy(true);
    setError(null);

    try {
      const token = newCsrfToken();
      // Lax + short-lived: it only has to survive this one round-trip.
      document.cookie = `${CSRF_COOKIE}=${token}; path=/; max-age=300; samesite=lax`;

      const res = await fetch('/api/demo-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrfToken: token }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Full navigation, not a router push: the response just set the session
        // cookie and every server component needs to re-render against it.
        window.location.assign(data.redirectTo ?? '/dashboard');
        return;
      }

      setError(data.error ?? 'The demo is unavailable right now.');
    } catch {
      setError('Could not start the demo. Check your connection and retry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-1 lg:items-start">
      <button
        type="button"
        onClick={startDemo}
        disabled={busy}
        className={className}
      >
        {busy ? 'Starting demo…' : children}
      </button>
      {error ? (
        <span role="alert" className="text-sm text-rose-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
