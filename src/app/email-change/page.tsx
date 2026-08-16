// Landing page after a user acts on an email-change link — either confirming
// the change from the new address, or revoking it from the old one. The
// /api/profile/email/{verify,cancel} routes do the work, then redirect here
// with a ?status telling us which message to show. Purely presentational,
// matching the playful magic-link pages so the flow feels consistent.

import Link from 'next/link';

type ResultStatus =
  'success' | 'invalid' | 'expired' | 'conflict' | 'cancelled';

const MESSAGES: Record<
  ResultStatus,
  { emoji: string; title: string; body: string }
> = {
  success: {
    emoji: '✅',
    title: 'Email updated',
    body: 'Your account email has been changed. Use your new address the next time you sign in.',
  },
  expired: {
    emoji: '⏰',
    title: 'Link expired',
    body: 'This confirmation link has expired. Open Settings and request the email change again to get a fresh link.',
  },
  conflict: {
    emoji: '🚫',
    title: 'Address already in use',
    body: 'That email address now belongs to another account, so we couldn’t complete the change. Try a different address from Settings.',
  },
  invalid: {
    emoji: '🔒',
    title: 'Link not valid',
    body: 'This confirmation link is invalid or has already been used. Open Settings and request the email change again if you still need to.',
  },
  cancelled: {
    emoji: '🛡️',
    title: 'Email change cancelled',
    body: 'Your account email is unchanged and the confirmation link no longer works. If you did not request that change, sign in and review your two-factor settings.',
  },
};

const FLOATERS = [
  { e: '📬', pos: 'left-[12%] top-[18%]', delay: '0s' },
  { e: '✉️', pos: 'right-[14%] top-[22%]', delay: '1.2s' },
  { e: '🔗', pos: 'left-[18%] bottom-[20%]', delay: '0.6s' },
  { e: '✨', pos: 'right-[16%] bottom-[24%]', delay: '1.8s' },
  { e: '🐾', pos: 'left-[44%] top-[10%]', delay: '2.4s' },
];

function normalizeStatus(value: string | string[] | undefined): ResultStatus {
  const status = Array.isArray(value) ? value[0] : value;
  if (
    status === 'success' ||
    status === 'expired' ||
    status === 'conflict' ||
    status === 'invalid' ||
    status === 'cancelled'
  ) {
    return status;
  }
  return 'invalid';
}

export default function EmailChangePage({
  searchParams,
}: {
  searchParams: { status?: string | string[] };
}) {
  const status = normalizeStatus(searchParams.status);
  const { emoji, title, body } = MESSAGES[status];

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

      <section className="animate-pop-in relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur">
        <span className="animate-pet-pop mx-auto block text-6xl">{emoji}</span>

        <h1 className="bg-gradient-to-r from-brand-600 to-mint-500 bg-clip-text text-2xl font-extrabold text-transparent">
          {title}
        </h1>

        <p className="text-sm text-slate-500">{body}</p>

        <Link
          href="/dashboard"
          className="text-sm font-medium text-brand-600 underline-offset-4 transition hover:text-brand-700 hover:underline"
        >
          Back to StudyPet+
        </Link>
      </section>
    </main>
  );
}
