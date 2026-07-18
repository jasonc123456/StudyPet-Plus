'use client';

// Passwordless magic-link sign-in, with optional Google OAuth (US-4.S2).
// NextAuth v4's `signIn` is client-side: the email flow posts to the Email
// provider (id "email"), which sends the link and redirects to the
// verify-request page; the Google flow redirects to Google's consent screen.
// `callbackUrl` is where the user lands afterwards.

import { signIn } from 'next-auth/react';
import { useState } from 'react';

// Decorative pet-themed emoji that bob around behind the card.
const FLOATERS = [
  { e: '🐾', pos: 'left-[12%] top-[18%]', delay: '0s' },
  { e: '✨', pos: 'right-[14%] top-[22%]', delay: '1.2s' },
  { e: '🃏', pos: 'left-[18%] bottom-[20%]', delay: '0.6s' },
  { e: '🎯', pos: 'right-[16%] bottom-[24%]', delay: '1.8s' },
  { e: '📖', pos: 'left-[44%] top-[10%]', delay: '2.4s' },
];

type LoginFormProps = {
  googleEnabled: boolean;
};

export function LoginForm({ googleEnabled }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="animate-gradient relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-100 via-white to-mint-400/40 px-6">
      {FLOATERS.map((f) => (
        <span
          key={f.e}
          aria-hidden
          className={`animate-drift pointer-events-none absolute text-3xl opacity-60 sm:text-4xl ${f.pos}`}
          style={{ animationDelay: f.delay }}
        >
          {f.e}
        </span>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          signIn('email', { email, callbackUrl: '/dashboard' });
        }}
        className="animate-pop-in relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur"
      >
        <span className="animate-pet-pop mx-auto block text-6xl">🐾</span>

        <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
          Sign in to StudyPet+
        </h1>

        <p className="text-sm text-slate-500">
          Enter your email and we&rsquo;ll send you a magic link &mdash; no
          password needed.
        </p>

        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-400"
        />

        <button
          type="submit"
          disabled={submitting}
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-mint-500 px-5 py-2.5 font-semibold text-white shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:scale-100"
        >
          <span className="transition-transform group-hover:-rotate-12">
            ✨
          </span>
          {submitting ? 'Sending…' : 'Send magic link'}
        </button>

        {googleEnabled ? (
          <>
            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95"
            >
              <GoogleGlyph />
              Continue with Google
            </button>
          </>
        ) : null}

        <p className="text-xs text-slate-400">
          We&rsquo;ll never share your email.
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        {/* One-click demo — skips the magic-link email entirely. Plain anchor so
            it hits the /api/demo-login server route (mints a demo session and
            redirects) rather than client-routing/prefetching the endpoint. */}
        <p className="text-sm text-slate-500">
          Haven&rsquo;t made up your mind yet? Try our demo!
        </p>
        <a
          href="/api/demo-login"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-white px-5 py-2.5 font-semibold text-brand-700 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95"
        >
          🚀 Try the demo
        </a>
      </form>
    </main>
  );
}

/** Google "G" mark, inlined so the login page stays self-contained. */
function GoogleGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.74z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.29a12 12 0 0 0 0 10.72l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.29 6.64l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
